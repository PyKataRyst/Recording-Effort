import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Play, Pause, Square, Flag, Save, Trash2, Download, Trash, CheckCircle2, Clock, History as HistoryIcon, Moon, Sun, BarChart3, List, Hash, Calendar, RotateCcw } from 'lucide-react'
import { SafeStorage } from './utils/SafeStorage'

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000

  const pad = (n: number, z: number = 2) => n.toString().padStart(z, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(Math.floor(milliseconds / 10), 2)}`
}

function formatDurationShort(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

// --- Hooks ---
const TIMER_KEY = 'timer-state'
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function useTimer() {
  const [time, setTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize Audio for Lock Screen support
  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI)
    audioRef.current.loop = true

    // Setup Media Session handlers
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => start())
      navigator.mediaSession.setActionHandler('pause', () => pause())
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update Lock Screen Display
  const updateMediaSession = useCallback((ms: number, running: boolean) => {
    if ('mediaSession' in navigator) {
      const timeStr = formatTime(ms).split('.')[0] // HH:MM:SS
      navigator.mediaSession.metadata = new MediaMetadata({
        title: running ? 'Focusing...' : 'Paused',
        artist: timeStr,
        artwork: [{ src: '/pwa-icon.png', sizes: '512x512', type: 'image/png' }]
      })
      navigator.mediaSession.playbackState = running ? 'playing' : 'paused'
    }
  }, [])

  // Restore state on mount
  useEffect(() => {
    const saved = SafeStorage.getItem(TIMER_KEY)
    if (saved) {
      try {
        const { isRunning: savedIsRunning, baseTime, pausedTime } = JSON.parse(saved)
        if (savedIsRunning && baseTime) {
          const now = Date.now()
          const elapsed = now - baseTime
          setTime(elapsed)
          setIsRunning(true)
          startTimeRef.current = baseTime
          // Try to resume audio if possible (might be blocked until interaction)
        } else if (pausedTime) {
          setTime(pausedTime)
          setIsRunning(false)
          updateMediaSession(pausedTime, false)
        }
      } catch (e) {
        console.error("Failed to restore timer", e)
      }
    }
  }, [updateMediaSession])

  // Timer Interval
  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - time
      }

      // Ensure audio is playing
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(e => console.log("Audio play failed (interaction needed)", e))
      }

      intervalRef.current = window.setInterval(() => {
        const now = Date.now()
        const elapsed = now - (startTimeRef.current || 0)
        setTime(elapsed)
        // Update lock screen every second roughly
        if (Math.floor(elapsed / 1000) > Math.floor(((elapsed - 50) / 1000))) {
          updateMediaSession(elapsed, true)
        }
      }, 50)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, updateMediaSession])

  const start = useCallback(() => {
    setTime(prev => {
      const now = Date.now()
      const baseTime = now - prev
      startTimeRef.current = baseTime

      SafeStorage.setItem(TIMER_KEY, JSON.stringify({
        isRunning: true,
        baseTime: baseTime
      }))
      return prev
    })
    setIsRunning(true)

    // Play silent audio to keep background alive
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Play error", e))
    }
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current
      setTime(elapsed)
      SafeStorage.setItem(TIMER_KEY, JSON.stringify({
        isRunning: false,
        pausedTime: elapsed
      }))
      updateMediaSession(elapsed, false)
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [updateMediaSession])

  const reset = useCallback(() => {
    setIsRunning(false)
    setTime(0)
    startTimeRef.current = null
    SafeStorage.removeItem(TIMER_KEY)
    updateMediaSession(0, false)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [updateMediaSession])

  const getLap = useCallback(() => {
    return startTimeRef.current ? Date.now() - startTimeRef.current : time
  }, [time])

  return {
    time,
    isRunning,
    start,
    pause,
    reset,
    getLap
  }
}

interface Record {
  id: string
  date: string
  startTime: string
  taskName: string
  duration: number
  laps: number[]
}

const STORAGE_KEY = 'recording-effort-history'

function useHistory() {
  const [records, setRecords] = useState<Record[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const saved = SafeStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setRecords(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse history", e)
      }
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      SafeStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    }
  }, [records, isLoaded])

  const addRecord = useCallback((record: Omit<Record, 'id'>) => {
    // Polyfill for randomUUID in insecure contexts (like HTTP LAN)
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }

    const newRecord = {
      ...record,
      id: generateId()
    }
    setRecords(prev => [newRecord, ...prev])
  }, [])

  const deleteRecord = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id))
  }, [])

  const clearHistory = useCallback(() => {
    if (confirm("Are you sure you want to clear all history?")) {
      setRecords([])
    }
  }, [])

  const exportCSV = useCallback(() => {
    if (records.length === 0) return

    const headers = ['Date', 'Start Time', 'Task Name', 'Duration (ms)', 'Duration (Formatted)', 'Laps Count']
    const rows = records.map(r => [
      r.date,
      r.startTime,
      `"${r.taskName.replace(/"/g, '""')}"`,
      r.duration,
      new Date(r.duration).toISOString().substr(11, 8),
      r.laps.length
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `effort_history_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [records])

  // Stats Logic
  const getStats = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)

    // Most recent unique task names (top 5 by usage freq)
    const taskCounts: { [key: string]: number } = {}
    records.forEach(r => {
      taskCounts[r.taskName] = (taskCounts[r.taskName] || 0) + 1
    })
    const frequentTasks = Object.entries(taskCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count desc
      .slice(0, 8) // Top 8
      .map(([name]) => name)

    const todayTotal = records
      .filter(r => r.date === today)
      .reduce((acc, curr) => acc + curr.duration, 0)

    const overallTotal = records
      .reduce((acc, curr) => acc + curr.duration, 0)

    // Group by Task Name for Stats
    const byTask: { [key: string]: number } = {}
    records.forEach(r => {
      byTask[r.taskName] = (byTask[r.taskName] || 0) + r.duration
    })

    return {
      frequentTasks,
      todayTotal,
      overallTotal,
      byTask
    }
  }, [records])

  return {
    records,
    addRecord,
    deleteRecord,
    clearHistory,
    exportCSV,
    getStats
  }
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const savedTheme = SafeStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    SafeStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  return { theme, toggleTheme }
}

// --- Components ---
interface TimerDisplayProps {
  time: number
}


function TimerDisplay({ time }: TimerDisplayProps) {
  // Format as HH:MM:SS for display stability
  const hours = Math.floor(time / 3600000)
  const minutes = Math.floor((time % 3600000) / 60000)
  const seconds = Math.floor((time % 60000) / 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-card/50 backdrop-blur-xl rounded-3xl shadow-2xl shadow-primary/10 border border-white/20 dark:border-white/5 w-full max-w-md transition-all duration-500 hover:shadow-primary/20 hover:scale-[1.02]">
      <div className="text-7xl md:text-8xl font-black tracking-tighter tabular-nums bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent transition-all duration-300 select-none drop-shadow-sm">
        {timeStr}
      </div>
      <div className="text-xs text-muted-foreground mt-4 uppercase tracking-[0.2em] font-bold opacity-70">
        Current Session
      </div>
    </div>
  )
}

interface TimerControlsProps {
  isRunning: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onLap: () => void
  onRecord: () => void
  hasTime: boolean
}

function TimerControls({
  isRunning,
  onStart,
  onPause,
  onReset,
  onLap,
  onRecord,
  hasTime
}: TimerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 w-full max-w-md">
      {!isRunning ? (
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground h-16 rounded-2xl font-bold text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-xl shadow-primary/25 active:scale-95"
        >
          <Play className="w-6 h-6 fill-current" />
          Start
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-rose-500 to-red-600 text-white h-16 rounded-2xl font-bold text-lg hover:from-rose-600 hover:to-red-700 hover:scale-[1.02] transition-all shadow-xl shadow-rose-500/30 active:scale-95 border border-rose-400/20"
        >
          <Pause className="w-6 h-6 fill-current" />
          Stop
        </button>
      )}

      <button
        onClick={onReset}
        disabled={!hasTime || isRunning}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-16 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-sm text-foreground font-bold text-lg transition-all active:scale-95 hover:bg-accent/50 hover:border-accent",
          (!hasTime || isRunning) ? "opacity-50 cursor-not-allowed" : ""
        )}
        title="Reset"
      >
        <RotateCcw className="w-5 h-5" />
        Reset
      </button>

      <button
        onClick={onRecord}
        disabled={!hasTime}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-16 rounded-2xl font-bold text-lg transition-all shadow-xl active:scale-95 hover:scale-[1.02]",
          !hasTime
            ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
            : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30 border border-emerald-400/20"
        )}
      >
        <Save className="w-6 h-6" />
        Record
      </button>
    </div>
  )
}

interface HistoryTableProps {
  records: Record[]
  onDelete: (id: string) => void
  onClear: () => void
  onExport: () => void
}

function HistoryTable({ records, onDelete, onClear, onExport }: HistoryTableProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">History</h2>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={onClear}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-destructive/20 text-destructive hover:bg-destructive/10 rounded-md disabled:opacity-50 transition-colors"
          >
            <Trash className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm transition-colors duration-300">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm text-left relative">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border transition-colors duration-300 sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-4 py-3 min-w-[100px]">Date</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3 min-w-[150px]">Task Name</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Laps</th>
                <th className="px-4 py-3 text-5 w-[50px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No records yet. Start focusing!
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{record.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono">{record.startTime}</td>
                    <td className="px-4 py-3 font-medium">{record.taskName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatTime(record.duration)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{record.laps.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(record.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, subtext }: { label: string, value: string, subtext?: string }) {
  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center">
      <div className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold text-foreground mt-2 tracking-tight">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-1">{subtext}</div>}
    </div>
  )
}

// --- Main App Component ---
function App() {
  const { time, isRunning, start, pause, reset, getLap } = useTimer()
  const { records, addRecord, deleteRecord, clearHistory, exportCSV, getStats } = useHistory()
  const { theme, toggleTheme } = useTheme()
  const [taskName, setTaskName] = useState(() => SafeStorage.getItem('current-task-name') || "Focus Time")
  const [laps, setLaps] = useState<number[]>([])
  const [showToast, setShowToast] = useState(false)
  const [activeTab, setActiveTab] = useState<'record' | 'stats'>('record')

  useEffect(() => {
    SafeStorage.setItem('current-task-name', taskName)
  }, [taskName])

  const stats = useMemo(() => getStats(), [getStats, records])

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  const handleLap = useCallback(() => {
    const lapTime = getLap()
    setLaps(prev => [...prev, lapTime])
  }, [getLap])

  const handleReset = useCallback(() => {
    reset()
    setLaps([])
  }, [reset])

  const handleRecord = useCallback(() => {
    if (time === 0) return

    pause()

    const now = new Date()
    const startTimeDate = new Date(now.getTime() - time)
    const startTimeStr = startTimeDate.toTimeString().slice(0, 5)
    const dateStr = now.toISOString().slice(0, 10)

    addRecord({
      date: dateStr,
      startTime: startTimeStr,
      taskName: taskName || "Untitled Task",
      duration: time,
      laps: laps
    })

    setShowToast(true)
    reset()
    setLaps([])
  }, [time, pause, taskName, laps, addRecord, reset])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300 relative overflow-hidden selection:bg-primary/20">

      {/* Background Blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none animate-pulse duration-[10000ms]" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* Toast */}
      <div className={cn(
        "fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-card/80 backdrop-blur-md text-foreground border border-border/50 rounded-2xl shadow-2xl transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)",
        showToast ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 pointer-events-none scale-95"
      )}>
        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
        <span className="font-bold tracking-tight">Effort Recorded!</span>
      </div>

      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Recording Effort</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            <div className="text-xs text-muted-foreground hidden sm:block">
              v1.2.0
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-8">

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('record')}
              className={cn(
                "px-6 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === 'record' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timer & History
              </span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={cn(
                "px-6 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === 'stats' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Statistics
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'record' ? (
          <>
            <section className="w-full flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="w-full max-w-md space-y-3">
                <label htmlFor="task-name" className="text-sm font-medium text-muted-foreground ml-1">
                  What are you working on?
                </label>
                <input
                  id="task-name"
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g., English Study"
                  className="w-full h-16 px-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all text-xl text-center placeholder:text-muted-foreground/40 text-foreground font-bold tracking-tight shadow-sm hover:bg-card/80"
                />

                {/* Shortcuts */}
                {stats.frequentTasks.length > 0 && (
                  <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                    {stats.frequentTasks.map(task => (
                      <button
                        key={task}
                        onClick={() => setTaskName(task)}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/80 transition-colors border border-transparent hover:border-border"
                      >
                        {task}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <TimerDisplay time={time} />

              <TimerControls
                isRunning={isRunning}
                onStart={start}
                onPause={pause}
                onReset={handleReset}
                onLap={handleLap}
                onRecord={handleRecord}
                hasTime={time > 0}
              />

              {laps.length > 0 && (
                <div className="w-full max-w-md bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground max-h-32 overflow-y-auto border border-border">
                  <div className="font-medium mb-2 text-foreground flex items-center gap-2">
                    <HistoryIcon className="w-3 h-3" />
                    Session Laps ({laps.length})
                  </div>
                  <ul className="space-y-1">
                    {laps.map((lap, i) => (
                      <li key={i} className="flex justify-between border-b border-border/50 last:border-0 pb-1 last:pb-0">
                        <span>Lap {i + 1}</span>
                        <span className="font-mono">{new Date(lap).toISOString().slice(11, 23)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="w-full h-px bg-border" />

            <section className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              <HistoryTable
                records={records}
                onDelete={deleteRecord}
                onClear={clearHistory}
                onExport={exportCSV}
              />
            </section>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
            <h2 className="text-2xl font-bold tracking-tight text-center">Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                label="Today's Total"
                value={formatDurationShort(stats.todayTotal)}
                subtext="Great job today!"
              />
              <StatCard
                label="All Time Total"
                value={formatDurationShort(stats.overallTotal)}
                subtext={`Across ${records.length} sessions`}
              />
              <StatCard
                label="Most Frequent Task"
                value={stats.frequentTasks[0] || "-"}
                subtext="Keep it up!"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Task Breakdown (All Time)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(stats.byTask)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, duration]) => (
                    <div key={name} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                      <span className="font-medium truncate mr-4" title={name}>{name}</span>
                      <span className="text-muted-foreground tabular-nums font-mono text-sm">{formatDurationShort(duration)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="p-6 text-center text-sm text-muted-foreground border-t border-border mt-auto">
        <p>&copy; {new Date().getFullYear()} Recording Effort.</p>
      </footer>
    </div>
  )
}

export default App
