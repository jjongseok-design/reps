/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#f97316',
        dark: '#0a0a0a',
        card: '#111111',
        card2: '#1a1a1a',
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        sans: ['Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
