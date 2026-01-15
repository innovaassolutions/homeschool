/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          50: '#EBF2FF',
          100: '#D6E4FF',
          200: '#B3CCFF',
          300: '#8BB3FF',
          400: '#6699FF',
          500: '#3B82F6',
          600: '#1E5FCC',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#1E3A8A',
        }
      }
    },
  },
  plugins: [],
}