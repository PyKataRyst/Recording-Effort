# Recording Effort

A modern, minimalist time-tracking application designed for focus and simplicity. Built with React and Tailwind CSS, featuring a premium glassmorphism UI.

## Features

- **⏱️ Precision Timer**: Simple Start/Stop/Reset controls with a clean digital display (HH:MM:SS).
- **📝 Effort Recording**: Log your tasks with "Record". Data is saved locally to your device.
- **📊 Statistics Dashboard**: Visual breakdown of your time:
  - Daily & Total effort summaries.
  - Most frequent tasks.
  - Detailed task distribution.
- **⚡ Smart Shortcuts**: Auto-suggests frequently used task names for quick entry.
- **📱 PWA Support**: optimized for iPhone and mobile devices.
  - "Add to Home Screen" capable (standalone mode).
  - Silent audio trick to keep timer running in background.
  - Lock screen timer integration (via Media Session API).
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
