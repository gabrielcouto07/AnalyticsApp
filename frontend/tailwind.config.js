import { tokens } from "./src/lib/theme.ts"

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ...tokens.colors, faint: "#475569" },
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      fontFamily: {
        sans: [tokens.typography.fontFamily],
      },
      fontSize: tokens.typography.fontSize,
      fontWeight: tokens.typography.fontWeight,
      lineHeight: tokens.typography.lineHeight,
      backgroundColor: {
        surface: tokens.colors.surface,
        card: tokens.colors.card,
      },
      textColor: {
        text: tokens.colors.text,
        muted: tokens.colors.muted,
        faint: "#475569",
      },
      borderColor: {
        border: tokens.colors.border,
      },
    },
  },
  plugins: [],
}
