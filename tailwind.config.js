/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Paleta de la demo aprobada (referencia/coachrd-demo.html). `*-dark` para el modo oscuro.
      colors: {
        brand: { DEFAULT: '#0E7C74', soft: '#E7F2F1', 'soft-dark': '#10302E' },
        canvas: { DEFAULT: '#F1F3F6', dark: '#07090C' },
        surface: { DEFAULT: '#FFFFFF', dark: '#0F1317' },
        surface2: { DEFAULT: '#F5F7FA', dark: '#161B21' },
        ink: { DEFAULT: '#0E1217', dark: '#EDF1F5' },
        muted: { DEFAULT: '#5C6774', dark: '#8E99A6' },
        line: { DEFAULT: '#E2E6EB', dark: '#222A33' },
        good: { DEFAULT: '#12814B', dark: '#3FD08A' },
        warn: { DEFAULT: '#A15C00', dark: '#F0B44C' },
        bad: { DEFAULT: '#C62F2F', dark: '#FF6B6B' },
      },
    },
  },
  plugins: [],
};
