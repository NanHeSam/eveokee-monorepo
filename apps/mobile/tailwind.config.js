/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{tsx,ts}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./screens/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}

