export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:   "#4f8ef7",
        secondary: "#a78bfa",
        accent:    "#06b6d4",
        success:   "#34c97e",
        warning:   "#f59e0b",
        danger:    "#f87171",
        surface:   "#0f172a",
        card:      "#1e293b",
        border:    "#334155",
        text:      "#f1f5f9",
        muted:     "#94a3b8",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
