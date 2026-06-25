import { type Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#05070F',
        surface: '#121A2F',
        'surface-light': '#1C1C2A',
        foreground: '#F2F2F7',
        'text-secondary': '#B3B8C8',
        'text-muted': '#6B6B80',
        primary: '#7C3AED',
        'primary-blue': '#2563EB',
        accent: '#EC4899',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        'star-yellow': '#F5C518',
        border: 'rgba(255, 255, 255, 0.07)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['SpaceMono', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      spacing: {
        '0.5': '2px',
        '18': '4.5rem',
      },
    },
  },
  plugins: [],
};

export default config;