import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ERP Analytics Frontend",
  description: "Frontend de analytics integrado ao backend ERP",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
