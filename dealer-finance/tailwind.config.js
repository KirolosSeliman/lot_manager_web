/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['Syne Mono', 'monospace'],
      },
      colors: {
        bg:       '#09090C',
        surface:  '#111116',
        surface2: '#18181F',
        surface3: '#1E1E28',
        line:     '#1F1F28',
        line2:    '#2A2A38',
        line3:    '#34344A',
        snow:     '#F4F3F8',
        snow2:    '#C8C7D4',
        snow3:    '#8A899A',
        dim:      '#55546A',
        dim2:     '#3A3950',
        go:       '#2DD4A0',
        stop:     '#E05A5A',
        warn:     '#E09050',
        info:     '#6C8EF5',
      },
    },
  },
  plugins: [],
}
