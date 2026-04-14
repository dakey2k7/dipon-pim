/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        navy: {
          50:  '#f0f4ff',
          100: '#e0e8ff',
          200: '#c7d4fe',
          300: '#a5b8fc',
          400: '#8196f8',
          500: '#6074f1',
          600: '#4a57e5',
          700: '#3b45ca',
          800: '#2f38a3',
          900: '#1a1f6e',
          950: '#0d1042',
        },
        surface: {
          900: '#0c0e1a',
          800: '#11142a',
          700: '#161930',
          600: '#1c2040',
          500: '#232750',
          400: '#2d3260',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'dot-grid': `radial-gradient(circle, rgb(139 92 246 / 0.15) 1px, transparent 1px)`,
        'glow-brand': 'radial-gradient(ellipse at center, rgb(139 92 246 / 0.15) 0%, transparent 70%)',
        'card-shine': 'linear-gradient(135deg, rgb(255 255 255 / 0.05) 0%, transparent 50%)',
      },
      backgroundSize: {
        'dot-grid': '28px 28px',
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgb(139 92 246 / 0.25)',
        'glow-md':  '0 0 24px rgb(139 92 246 / 0.3)',
        'glow-lg':  '0 0 48px rgb(139 92 246 / 0.2)',
        'card':     '0 4px 24px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.05)',
        'card-hover': '0 8px 32px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.08)',
        'inner-glow': 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
