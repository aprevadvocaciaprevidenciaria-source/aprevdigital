/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Índigo escuro oficial SEO Local Brasil (#16233F)
        primary: {
          50: '#eef1f6',
          100: '#dde3ed',
          200: '#b8c3d6',
          300: '#8fa0ba',
          400: '#5b7093',
          500: '#3a4f72',
          600: '#263a5c',
          700: '#1c2d4c',
          800: '#16233F',
          900: '#0F1A2E',
        },
        // Verde-menta oficial SEO Local Brasil (#16C79A)
        secondary: {
          50: '#e9fbf6',
          100: '#cdf7ea',
          200: '#9aeed6',
          300: '#62e0bd',
          400: '#34d1a4',
          500: '#16C79A',
          600: '#10a37e',
          700: '#0c7f63',
          800: '#0a654f',
          900: '#084f3f',
        },
        night: '#0F1A2E',
        fog: '#F5F7FA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(150deg, #22345C 0%, #16233F 55%, #0F1A2E 100%)',
      },
    },
  },
  plugins: [],
}
