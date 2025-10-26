/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Uncial Antiqua"', 'serif'],
      },
      colors: {
        parchment: 'var(--parchment)'
      },
      boxShadow: {
        glow: '0 0 10px rgba(251, 191, 36, 0.6)'
      }
    },
  },
  plugins: [],
}
