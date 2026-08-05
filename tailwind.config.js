/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Azul-marinho oficial APREV (#022251)
        primary: {
          50: '#e8ebf1',
          100: '#c5cddc',
          200: '#9aa8c2',
          300: '#6f83a8',
          400: '#455e8e',
          500: '#284475',
          600: '#173161',
          700: '#0d2650',
          800: '#022251',
          900: '#011433',
        },
        // Dourado oficial APREV (#9B6A27, tom claro #E0D280)
        secondary: {
          50: '#fbf6e8',
          100: '#f5e9c9',
          200: '#eddb9c',
          300: '#e0d280',
          400: '#c9a94f',
          500: '#9B6A27',
          600: '#7e5620',
          700: '#63421a',
          800: '#4a3113',
          900: '#33220d',
        },
        night: '#011433',
        fog: '#F5F7FA',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Poppins', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(150deg, #0d2f66 0%, #022251 55%, #011433 100%)',
      },
    },
  },
  plugins: [],
}
