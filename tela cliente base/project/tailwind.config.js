/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f7f4ed',
        surface: '#f0ede5',
        card: '#ffffff',
        edge: '#eceae4',
        charcoal: '#1c1c1c',
        muted: '#5f5f5d',
        available: {
          text: '#15803d',
          bg: '#dcfce7',
          border: '#16a34a',
        },
        pending: {
          text: '#b45309',
          bg: '#fef3c7',
        },
        blocked: {
          text: '#1f2937',
          bg: '#e2e8f0',
        },
        error: {
          text: '#9b2226',
          bg: '#fce8e8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,28,28,0.04), 0 4px 16px rgba(28,28,28,0.06)',
        sheet: '0 -8px 32px rgba(28,28,28,0.18)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        fadeIn: 'fadeIn 0.2s ease-out',
        scaleIn: 'scaleIn 0.24s cubic-bezier(0.22,1,0.36,1)',
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
