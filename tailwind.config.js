/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F5F2',
        ink: {
          DEFAULT: '#171A21',
          soft: '#3A404C',
          muted: '#6B7280',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F0EFEA',
          dark: '#12151C',
          darkraised: '#1B1F29',
        },
        line: {
          DEFAULT: '#E4E2DC',
          dark: '#272C38',
        },
        kiln: {
          50: '#FBF1E6',
          100: '#F5DEC0',
          200: '#EAC08A',
          300: '#DDA25B',
          400: '#CE8B3C',
          500: '#B8722A',
          600: '#96591F',
          700: '#744319',
          DEFAULT: '#B8722A',
        },
        status: {
          draft: '#6B7280',
          pending: '#B8722A',
          approved: '#2E7D5B',
          rejected: '#B0392E',
          issued: '#2A5FB0',
          collected: '#1F7A55',
          cancelled: '#8A8378',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,26,33,0.04), 0 1px 1px rgba(23,26,33,0.03)',
        raised: '0 4px 16px rgba(23,26,33,0.08)',
        popover: '0 12px 32px rgba(23,26,33,0.14)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};
