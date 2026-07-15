/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Midnight base — deep teal-tinted blacks
        ink: {
          950: '#05090c',
          900: '#081014',
          850: '#0c1620',
          800: '#101c28',
          750: '#15232f',
          700: '#1a2a38',
          650: '#21333f',
          600: '#2a3d4a',
          500: '#3a4f5c',
          400: '#566974',
          300: '#7a8d96',
          200: '#a3b4bc',
          100: '#cfd8dd',
          50:  '#eef3f5',
        },
        // Teal primary
        brand: {
          50:  '#d6fbf3',
          100: '#aaf5e8',
          200: '#6febd6',
          300: '#34dcc2',
          400: '#14c4ad',
          500: '#0aa895',
          600: '#08897a',
          700: '#086c60',
          800: '#0a544b',
          900: '#0a3e38',
        },
        // Pink/rose accent for likes
        accent: {
          300: '#ff9eb8',
          400: '#ff6f94',
          500: '#f94d7c',
          600: '#e0345f',
        },
      },
      boxShadow: {
        glow: '0 0 30px -6px rgba(20,196,173,0.45)',
        'glow-lg': '0 0 80px -12px rgba(20,196,173,0.4)',
        card: '0 12px 32px -12px rgba(0,0,0,0.65)',
        float: '0 -8px 40px -12px rgba(0,0,0,0.8)',
        'glass': '0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'sheet-in': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-right': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-vinyl': {
          '100%': { transform: 'rotate(360deg)' },
        },
        'bar-rise': {
          '0%,100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'float-glow': {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.6' },
        },
        // Lyrics line: slides in from below with fade
        'lyric-enter': {
          '0%': { opacity: '0', transform: 'translateY(28px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Active line glow pulse
        'lyric-pulse': {
          '0%,100%': { textShadow: '0 0 20px rgba(20,196,173,0.0)' },
          '50%': { textShadow: '0 0 20px rgba(20,196,173,0.5)' },
        },
        // Typing cursor blink
        'cursor-blink': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-up': 'sheet-up 0.38s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-in': 'sheet-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
        'slide-right': 'slide-right 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'spin-vinyl': 'spin-vinyl 20s linear infinite',
        'bar-rise': 'bar-rise 0.9s ease-in-out infinite',
        'float-glow': 'float-glow 4s ease-in-out infinite',
        'lyric-enter': 'lyric-enter 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'lyric-pulse': 'lyric-pulse 3s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
