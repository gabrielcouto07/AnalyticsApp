"use client"

import React, { useEffect, useMemo, useState } from "react"
import { API_BASE_URL } from "../api/client"
import { fmtNum } from "../lib/formatters"

interface AnalyticsProps {
  sessionId: string
}

interface ColumnProfile {
  name: string
  data_type?: string
  null_pct?: number
  unique_count?: number
  numeric_stats?: {
    min?: number | null
    max?: number | null
    mean?: number | null
    std?: number | null
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const fmt = (value: unknown) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return "-"
  return fmtNum(Math.round(number * 100) / 100)
}

const nullBadgeStyle = (pct: number): React.CSSProperties => {
  if (pct < 5) return { background: "#dcfce7", color: "#166534" }
  if (pct <= 20) return { background: "#fef9c3", color: "#854d0e" }
  return { background: "#fee2e2", color: "#991b1b" }
}

const normalizeProfile = (payload: any) => {
  const profile = payload?.data_profile ?? payload ?? {}
  const structure = profile.structure ?? profile.summary ?? {}
  const columns: ColumnProfile[] = Array.isArray(profile.columns)
    ? profile.columns.map((column: any) => ({
      name: String(column.name ?? column.column ?? ""),
      data_type: column.data_type ?? column.type ?? "-",
      null_pct: Number(column.null_pct ?? column.null_percentage ?? 0),
      unique_count: Number(column.unique_count ?? column.unique ?? 0),
      numeric_stats: column.numeric_stats ?? column.stats ?? {},
    }))
    : []

  return { structure, columns }
}

export const ProfilerDashboard: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [payload, setPayload] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/api/profiler/${sessionId}/profile`)
      .then((response) => {
        if (!response.ok) throw new Error("profile")
        return response.json()
      })
      .then((data) => alive && setPayload(data))
      .catch(() => alive && setError("Erro ao carregar dados."))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [sessionId])

  const { structure, columns } = useMemo(() => normalizeProfile(payload), [payload])
  const filteredColumns = columns.filter((column) => column.name.toLowerCase().includes(search.toLowerCase()))
  const numericColumns = columns.filter((column) => ["integer", "float", "number", "numeric"].includes(String(column.data_type).toLowerCase())).length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Data Profiler</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Resumo técnico da qualidade, tipos e completude dos dados importados.
        </p>
      </div>

      {loading && (
        <div style={cardStyle}>
          <p style={{ color: "#64748b", margin: 0 }}>Carregando...</p>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} style={{ height: 14, marginTop: 14, borderRadius: 999, background: "linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0)" }} />
          ))}
        </div>
      )}
      {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>}

      {!loading && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              ["Total Colunas", structure.total_columns ?? columns.length],
              ["Total Linhas", structure.total_rows ?? "-"],
              ["% Nulos", `${fmt(structure.null_cells_pct ?? structure.null_percentage ?? 0)}%`],
              ["Colunas Numéricas", numericColumns],
            ].map(([label, value]) => (
              <div key={String(label)} style={cardStyle}>
                <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</p>
                <p style={{ margin: "8px 0 0", color: "#0b4f3a", fontSize: 28, fontWeight: 800 }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar coluna..."
              style={{ width: "100%", maxWidth: 360, padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 16 }}
            />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Coluna", "Tipo", "Nulos%", "Únicos", "Mín", "Máx", "Média", "Desvio Padrão"].map((header) => (
                      <th key={header} style={thStyle}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredColumns.map((column) => {
                    const nullPct = Number(column.null_pct ?? 0)
                    const stats = column.numeric_stats ?? {}
                    return (
                      <tr key={column.name}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{column.name}</td>
                        <td style={tdStyle}>{column.data_type ?? "-"}</td>
                        <td style={tdStyle}>
                          <span style={{ display: "inline-block", borderRadius: 999, padding: "3px 8px", fontWeight: 800, ...nullBadgeStyle(nullPct) }}>
                            {fmt(nullPct)}%
                          </span>
                        </td>
                        <td style={tdStyle}>{fmt(column.unique_count)}</td>
                        <td style={tdStyle}>{fmt(stats.min)}</td>
                        <td style={tdStyle}>{fmt(stats.max)}</td>
                        <td style={tdStyle}>{fmt(stats.mean)}</td>
                        <td style={tdStyle}>{fmt(stats.std)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  textTransform: "uppercase",
  fontSize: 11,
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
}
