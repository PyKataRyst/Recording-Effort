import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Play, Pause, Save, Trash2, Download, Trash, CheckCircle2, Clock, Moon, Sun, BarChart3, RotateCcw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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


function useTimer() {
  const [time, setTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  // Calculate elapsed time helper
  const updateTime = useCallback(() => {
    if (startTimeRef.current) {
      const now = Date.now()
      const elapsed = now - startTimeRef.current
      setTime(elapsed)
      return elapsed
    }
    return 0
  }, [])

  // Initialize Media Session for Lock Screen support (simulated, works best with active audio but we try without blocking)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => start())
      navigator.mediaSession.setActionHandler('pause', () => pause())
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

  // Timer Interval & Visibility Handling
  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - time
      }

      intervalRef.current = window.setInterval(() => {
        const elapsed = updateTime()
        // Update lock screen every second roughly
        if (Math.floor(elapsed / 1000) > Math.floor(((elapsed - 50) / 1000))) {
          updateMediaSession(elapsed, true)
        }
      }, 50)

      // Re-sync on visibility change to catch up if interval was throttled
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateTime()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, updateMediaSession, updateTime])

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
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
    if (startTimeRef.current) {
      const elapsed = updateTime()
      SafeStorage.setItem(TIMER_KEY, JSON.stringify({
        isRunning: false,
        pausedTime: elapsed
      }))
      updateMediaSession(elapsed, false)
    }
  }, [updateMediaSession, updateTime])

  const reset = useCallback(() => {
    setIsRunning(false)
    setTime(0)
    startTimeRef.current = null
    SafeStorage.removeItem(TIMER_KEY)
    updateMediaSession(0, false)
  }, [updateMediaSession])



  return {
    time,
    isRunning,
    start,
    pause,
    reset
  }
}

interface Record {
  id: string
  date: string
  startTime: string
  taskName: string
  duration: number
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

    const headers = ['Date', 'Start Time', 'Task Name', 'Duration (ms)', 'Duration (Formatted)']
    const rows = records.map(r => [
      r.date,
      r.startTime,
      `"${r.taskName.replace(/"/g, '""')}"`,
      r.duration,
      new Date(r.duration).toISOString().substr(11, 8)
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
    // Generate date keys for the last 30 days
    const daysToShow = 30
    const dateKeys: string[] = []
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(new Date().getDate() - i)
      dateKeys.push(d.toISOString().slice(0, 10))
    }

    // Identify top tasks (top 5 by total duration)
    const taskTotalDurations: { [key: string]: number } = {}
    records.forEach(r => {
      taskTotalDurations[r.taskName] = (taskTotalDurations[r.taskName] || 0) + r.duration
    })

    // Create sorted summary array
    const taskSummaries = Object.entries(taskTotalDurations)
      .map(([name, totalDuration]) => ({ name, totalDuration }))
      .sort((a, b) => b.totalDuration - a.totalDuration)

    const topTasks = taskSummaries
      .slice(0, 5)
      .map(t => t.name)

    // Build chart data
    const chartData = dateKeys.map(date => {
      const point: any = { date }
      topTasks.forEach(task => {
        point[task] = 0
      })
      return point
    })

    records.forEach(r => {
      const dataPoint = chartData.find(d => d.date === r.date)
      if (dataPoint && topTasks.includes(r.taskName)) {
        // Convert ms to minutes
        dataPoint[r.taskName] += r.duration / 60000
      }
    })

    // Most recent unique task names (top 8 by usage freq) for shortcuts
    const taskCounts: { [key: string]: number } = {}
    records.forEach(r => {
      taskCounts[r.taskName] = (taskCounts[r.taskName] || 0) + 1
    })
    const frequentTasks = Object.entries(taskCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)

    return {
      frequentTasks,
      chartData,
      topTasks,
      taskSummaries
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
  onRecord: () => void
  hasTime: boolean
}

function TimerControls({
  isRunning,
  onStart,
  onPause,
  onReset,
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
                <th className="px-5 py-3 w-[50px]"></th>
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

function TaskSummaryCards({ summaries }: { summaries: { name: string, totalDuration: number }[] }) {
  // Colors for styling - simple cycling or hashing could differ from chart but totally fine
  const gradients = [
    "from-emerald-500/20 to-teal-500/5 hover:to-teal-500/10 border-emerald-500/20",
    "from-blue-500/20 to-indigo-500/5 hover:to-indigo-500/10 border-blue-500/20",
    "from-amber-500/20 to-orange-500/5 hover:to-orange-500/10 border-amber-500/20",
    "from-rose-500/20 to-pink-500/5 hover:to-pink-500/10 border-rose-500/20",
    "from-violet-500/20 to-purple-500/5 hover:to-purple-500/10 border-violet-500/20",
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
      {summaries.map((task, index) => {
        const style = gradients[index % gradients.length]
        return (
          <div
            key={task.name}
            className={cn(
              "rounded-2xl p-5 border backdrop-blur-sm shadow-sm transition-all hover:scale-[1.02] hover:shadow-md bg-gradient-to-br",
              style
            )}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-background/80 p-2 rounded-lg shadow-sm">
                <BarChart3 className="w-4 h-4 text-foreground/80" />
              </div>
              <h3 className="font-semibold tracking-tight text-sm text-foreground/90 truncate flex-1" title={task.name}>
                {task.name}
              </h3>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black tabular-nums tracking-tighter">
                {formatDurationShort(task.totalDuration).split(' ')[0]}
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                {formatDurationShort(task.totalDuration).split(' ')[1]}
              </span>
            </div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1 opacity-70 tracking-widest">
              Total Duration
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EffortTrendChart({ data, tasks }: { data: any[], tasks: string[] }) {
  // Safe colors even if many tasks
  const colors = [
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ]

  return (
    <div className="w-full h-[500px] bg-card/ border border-border rounded-2xl p-2 sm:p-6 shadow-sm flex flex-col">
      <h3 className="text-lg font-bold mb-6 text-center flex items-center justify-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        30-Day Effort Trends (Minutes)
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/20" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-muted-foreground/70"
              tickFormatter={(value) => value.slice(5)}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-muted-foreground/70"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '12px',
                color: 'hsl(var(--foreground))',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
              itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '0.9rem', fontWeight: 500 }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px', fontSize: '0.8rem' }}
              formatter={(value: any) => [`${Math.floor(Number(value))} min`, '']}
              labelFormatter={(label) => `Date: ${label}`}
              cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, opacity: 0.5 }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
            />
            {tasks.map((task, index) => (
              <Line
                key={task}
                type="monotone"
                dataKey={task}
                stroke={colors[index % colors.length]}
                activeDot={{ r: 6, strokeWidth: 0 }}
                strokeWidth={3}
                dot={false}
                connectNulls
                animationDuration={1500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


// --- Main App Component ---
function App() {
  const { time, isRunning, start, pause, reset } = useTimer()
  const { records, addRecord, deleteRecord, clearHistory, exportCSV, getStats } = useHistory()
  const { theme, toggleTheme } = useTheme()
  const [taskName, setTaskName] = useState(() => SafeStorage.getItem('current-task-name') || "Focus Time")
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

  const handleReset = useCallback(() => {
    reset()
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
      duration: time
    })

    setShowToast(true)
    reset()
  }, [time, pause, taskName, addRecord, reset])

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
                onRecord={handleRecord}
                hasTime={time > 0}
              />
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
            <div className="w-full flex flex-col gap-6">
              <h2 className="text-2xl font-bold tracking-tight text-center">Your Progress Dashboard</h2>

              {stats.taskSummaries.length > 0 && (
                <TaskSummaryCards summaries={stats.taskSummaries} />
              )}

              {stats.topTasks.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 bg-card/50 rounded-2xl border border-border/50">
                  <p className="text-lg">No activity yet.</p>
                  <p className="text-sm">Start a task to see your trends graph!</p>
                </div>
              ) : (
                <EffortTrendChart data={stats.chartData} tasks={stats.topTasks} />
              )}
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
