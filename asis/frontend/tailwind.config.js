/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './contexts/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { base: '#070b14', surface: '#0c1220', elevated: '#111827' },
        accent: { DEFAULT: '#6366f1', dim: 'rgba(99,102,241,0.1)' },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
      },
      animation: {
        spin: 'spin 0.8s linear infinite',
        blink: 'blink 1s step-end infinite',
        fadeIn: 'fadeIn 0.5s ease forwards',
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulse: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
    },
  },
  plugins: [],
};
