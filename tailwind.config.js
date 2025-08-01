/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './themes/bufoindex/layouts/**/*.html',
    './content/**/*.{html,md}',
    './themes/bufoindex/static/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'sage': '#7FB069',
        'sage-dark': '#6A9358',
        'sage-light': '#9BC58A',
        'terminal-black': '#0A0E1A',
        'terminal-green': '#00FF41',
        'accent': '#FFB86C',
        'background': '#FAFAF9',
        'text-primary': '#1A202C',
        'text-secondary': '#4A5568',
        'text-light': '#E4E4E7',
      },
      fontFamily: {
        'serif': ['Charter', 'Crimson Pro', 'Georgia', 'serif'],
        'mono': ['IBM Plex Mono', 'Fira Code', 'Consolas', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            color: '#1A202C',
            a: {
              color: '#7FB069',
              '&:hover': {
                color: '#6A9358',
              },
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              backgroundColor: '#F7FAFC',
              borderRadius: '0.25rem',
              paddingLeft: '0.375rem',
              paddingRight: '0.375rem',
              paddingTop: '0.125rem',
              paddingBottom: '0.125rem',
              fontWeight: '400',
            },
          },
        },
      },
    },
  },
  plugins: [],
}