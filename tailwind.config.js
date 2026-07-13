/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/views/**/*.ejs",
    "./src/public/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6D28F5',
          light: '#8B5CF6',
        },
        secondary: '#FBBF24',
        dark: '#0F172A',
        white: '#FFFFFF',
        grayCustom: '#F8FAFC',
        borderCustom: '#E5E7EB',
      },
    },
  },
  plugins: [],
}
