/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'bg-primary': '#0f1117',
        'bg-secondary': '#1a1d27',
        'bg-tertiary': '#242836',
        'bg-card': '#1e2130',
        'bg-hover': '#2a2e3f',
        accent: {
          DEFAULT: '#00d4aa',
          dim: '#00a886',
        },
        purple: {
          DEFAULT: '#7c5cfc',
          dim: '#5a3fd4',
        },
        planner: '#ff8c42',
        programmer: '#4dabf7',
        artist: '#f06595',
        'text-primary': '#e8eaf0',
        'text-secondary': '#9ca3b8',
        'text-muted': '#6b7280',
        border: '#2d3148',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
