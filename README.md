# Recording Effort

A modern, minimalist time-tracking application designed for focus and simplicity. Built with React and Tailwind CSS, featuring a premium glassmorphism UI.

## 💡 Why I Built This (The Survival Strategy)

As a Ph.D. engineer battling a progressive neuromuscular disease, my physical energy is a finite resource. Existing time trackers were too complex or required too many clicks.

I built Recording Effort to serve as a "Cockpit" for my life. While task names are fully customizable for anyone, I use them to manage two critical lifelines:

📉 Physical Monitoring ("Standing" Task): I must navigate a narrow path. Sedentary behavior accelerates muscle atrophy, yet overexertion triggers a 2-day physical shutdown (severe muscle pain). By precisely tracking my "Standing" time, I can find the optimal threshold to maintain function without crossing the danger line.

📈 Future Investment ("Dev / English / Blog"): Building a career without physical movement requires mental endurance. Visualizing the exact time invested in English, YouTube, and Blog creation creates a positive feedback loop, keeping my motivation high even on difficult days.

## Features

- **⏱️ Precision Timer**: Simple Start/Stop/Reset controls with a clean digital display (HH:MM:SS) and "Immersive Focus Mode" design.
- **📝 Effort Recording**: Log your tasks with "Record". Data is saved locally to your device.
- **📊 Advanced Statistics**:
  - **Task Cards**: "Today / Total / Average" 3-point scorecard for each task.
  - **Trend Chart**: 30-day effort visualization.
  - **Renaming**: Easily correct or update task names across all history.
- **⚡ Smart Shortcuts**: Auto-suggests frequently used task names for quick entry.
- **📱 PWA Support**: Optimized for iPhone and mobile devices.
  - "Add to Home Screen" capable (standalone mode).
  - Lock screen timer integration (via Media Session API).
- **🤝 Share**: Share the app with friends via native share sheet or clipboard.
- **💾 Local Persistence**: All data remains in your browser's `localStorage`. No login or account required.
- **🌑 Dark/Light Mode**: Automatic theme detection with manual toggle.
- **🎨 Premium UI**: Glassmorphism effects, animated backgrounds, and modern gradients.

## Tech Stack

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Language**: TypeScript

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/RecordingEffort.git
   cd RecordingEffort
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Access the app at `http://localhost:5173`.

## Mobile Usage (iPhone)

1. Ensure your PC and iPhone are on the same Wi-Fi.
2. Run `npm run dev`. The terminal will show a Network URL (e.g., `http://192.168.x.x:5173`).
3. Open Safari on iPhone and visit that URL.
4. Tap "Share" -> "Add to Home Screen" to install as a standalone app.

## License

Private.
