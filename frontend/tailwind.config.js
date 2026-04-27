/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: "#0b4f3a",
          primary: "#1f7a5a",
          accent: "#cbbba0",
        },
      },
      boxShadow: {
        glass: "0 12px 34px rgba(11, 79, 58, 0.16)",
      },
    },
  },
  plugins: [],
}
