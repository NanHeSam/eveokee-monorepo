/** @type {import('tailwindcss').Config} */

import tailwindScrollbar from 'tailwind-scrollbar';

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        accent: {
          mint: '#52C7A0',
          apricot: '#FFB5A7',
          coral: '#FFB5A7',
        },
        background: {
          light: '#FDFBF7',
        },
      },
    },
  },
  plugins: [tailwindScrollbar],
};
