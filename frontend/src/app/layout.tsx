import type { Metadata } from "next"
import "./globals.css"
import "./theme.css"

export const metadata: Metadata = {
  title: "ERP Analytics",
  description: "Analytics integrado ao ERP",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
