/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Design system (src/ui) ─────────────────────────────
        // Brand: anchored on the Ethiopian flag green (brand-600 = #078930).
        brand: {
          50: '#eefbf2',
          100: '#d5f5df',
          200: '#aeeac3',
          300: '#78d89c',
          400: '#3fbe70',
          500: '#17a24f',
          600: '#078930',
          700: '#076d29',
          800: '#0a5724',
          900: '#0a4720',
          950: '#03280f',
        },
        // Flag accents — use sparingly (flag bars, highlights, live dots).
        flag: {
          green: '#078930',
          yellow: '#FCDD09',
          red: '#DA121A',
        },
        // Theme-aware neutrals, driven by CSS variables in src/index.css.
        canvas: 'rgb(var(--ui-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--ui-surface) / <alpha-value>)',
          2: 'rgb(var(--ui-surface-2) / <alpha-value>)',
          3: 'rgb(var(--ui-surface-3) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--ui-line) / <alpha-value>)',
          strong: 'rgb(var(--ui-line-strong) / <alpha-value>)',
        },
        fg: 'rgb(var(--ui-fg) / <alpha-value>)',
        muted: 'rgb(var(--ui-muted) / <alpha-value>)',
        subtle: 'rgb(var(--ui-subtle) / <alpha-value>)',
        // Warm gold accent (landing "coffee & gold" theme). DEFAULT is theme-aware for text contrast.
        gold: {
          DEFAULT: 'rgb(var(--ui-gold) / <alpha-value>)',
          bright: '#F2B705',
          deep: '#8A5A00',
        },
        // ── Legacy palette (existing pages) ────────────────────
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: '#f5f3ff',
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
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        info: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        }
      },
      fontFamily: {
        // Inter has no Ge'ez glyphs, so the browser falls through to
        // Noto Sans Ethiopic for Amharic characters automatically.
        sans: ['Inter', '"Noto Sans Ethiopic"', 'system-ui', '-apple-system', 'sans-serif'],
        // Editorial display face for headings: Fraunces (Latin) + Noto Serif Ethiopic (Ge'ez).
        display: ['Fraunces', '"Noto Serif Ethiopic"', 'Georgia', 'serif'],
        ethiopic: ['"Noto Sans Ethiopic"', 'Nyala', '"Abyssinica SIL"', 'Inter', 'system-ui', 'sans-serif'],
      },
      // Radius scale: Tailwind defaults — rounded-md (6px) controls, rounded-lg (8px)
      // inputs/buttons, rounded-xl (12px) cards, rounded-2xl (16px) dialogs.
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.04)',
        raised: '0 4px 12px -2px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        overlay: '0 24px 48px -12px rgb(0 0 0 / 0.35), 0 8px 16px -8px rgb(0 0 0 / 0.2)',
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ui-fade-in': 'ui-fade-in 150ms ease-out',
        'ui-pop-in': 'ui-pop-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        'ui-slide-in': 'ui-slide-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        'ui-toast-in': 'ui-toast-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        'ui-shimmer': 'ui-shimmer 1.6s infinite',
        marquee: 'marquee 45s linear infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'eq-bar': 'eq-bar 1s ease-in-out infinite',
      },
      keyframes: {
        ping: {
          '75%, 100%': {
            transform: 'scale(2)',
            opacity: '0',
          },
        },
        pulse: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '.5',
          },
        },
        'ui-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ui-pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ui-slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'ui-toast-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ui-shimmer': { '100%': { transform: 'translateX(100%)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'float-slow': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        'eq-bar': { '0%, 100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
    },
  },
  plugins: [],
}
