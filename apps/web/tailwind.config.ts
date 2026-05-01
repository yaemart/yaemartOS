import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './providers/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-light': 'rgb(var(--brand-primary-light) / <alpha-value>)',
          'primary-dark': 'rgb(var(--brand-primary-dark) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
          bg: 'rgb(var(--brand-bg) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface) / <alpha-value>)',
          text: 'rgb(var(--brand-text) / <alpha-value>)',
          'text-secondary': 'rgb(var(--brand-text-secondary) / <alpha-value>)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--brand-radius)',
      },
      zIndex: {
        sticky: '10',
        dropdown: '20',
        overlay: '30',
        modal: '40',
        toast: '50',
        tooltip: '60',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.05)',
        sm: '0 1px 3px rgba(0,0,0,0.1)',
        md: '0 4px 6px rgba(0,0,0,0.1)',
        lg: '0 10px 15px rgba(0,0,0,0.1)',
        xl: '0 20px 25px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
