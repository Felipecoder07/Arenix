/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f7f4ed',
        'cream-surface': '#f0ede5',
        'off-white': '#fcfbf8',
        charcoal: {
          DEFAULT: '#1c1c1c',
          82: 'rgba(28, 28, 28, 0.82)',
          60: 'rgba(28, 28, 28, 0.60)',
          40: 'rgba(28, 28, 28, 0.40)',
          12: 'rgba(28, 28, 28, 0.12)',
          '06': 'rgba(28, 28, 28, 0.06)',
          '03': 'rgba(28, 28, 28, 0.03)',
        },
        muted: '#5f5f5d',
        'border-passive': '#eceae4',
        // semantic
        success: '#2f7d4f',
        'success-soft': '#e8f3ec',
        warning: '#b07a1e',
        'warning-soft': '#f7ecd6',
        danger: '#b3261e',
        'danger-soft': '#f6e2e0',
        'master-accent': '#1c1c1c',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,28,28,0.04), 0 1px 1px rgba(28,28,28,0.03)',
        'card-hover': '0 4px 14px rgba(28,28,28,0.08)',
        overlay: '0 12px 40px rgba(28,28,28,0.18)',
      },
      borderRadius: {
        xl: '10px',
        '2xl': '14px',
      },
    },
  },
  plugins: [],
};
