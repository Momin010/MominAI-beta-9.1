/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,index}.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0D0D0F',
        'brand-surface': '#1C1C1E',
        'brand-subtle': '#3A3A3C',
        'brand-muted': '#8E8E93',
        'brand-accent': '#3B82F6', // Stays as a primary action color
        'ide-bg': '#161618',
        'ide-bg-darker': '#111113',
        // Theme variants for light/dark mode
        'light-bg': '#FFFFFF',
        'light-surface': '#F8F9FA',
        'light-subtle': '#E9ECEF',
        'light-muted': '#6C757D',
        'light-accent': '#007BFF',
        'light-text': '#212529',
        'dark-bg': '#0D0D0F',
        'dark-surface': '#1C1C1E',
        'dark-subtle': '#3A3A3C',
        'dark-muted': '#8E8E93',
        'dark-accent': '#3B82F6',
        'dark-text': '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      animation: {
        blob: "blob 7s infinite",
      }
    }
  },
  plugins: [],
}
