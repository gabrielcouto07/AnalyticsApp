"use client"

import React, { useState } from "react"
import { API_BASE_URL } from "../api/client"

interface AnalyticsProps {
  sessionId: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

export const ExportarView: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportExcel = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/export/${sessionId}`)
      if (!response.ok) throw new Error("export")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "analytics_export.xlsx"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Exportar Dados</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Baixe os dados tratados da sessão atual.
        </p>
      </div>

      <div style={cardStyle}>
        <button
          type="button"
          onClick={exportExcel}
          disabled={loading}
          style={{
            background: "#0b4f3a",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.65 : 1,
          }}
        >
          ⬇ Exportar Excel
        </button>
        {loading && <p style={{ margin: "12px 0 0", color: "#64748b" }}>Carregando...</p>}
        {error && <p style={{ margin: "12px 0 0", color: "#ef4444" }}>Erro ao carregar dados.</p>}
      </div>
    </div>
  )
}
