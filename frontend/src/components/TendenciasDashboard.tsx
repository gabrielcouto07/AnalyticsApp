"use client"

import React, { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { API_BASE_URL } from "../api/client"

interface AnalyticsProps {
  sessionId: string
}

interface TrendPoint {
  index: number
  value: number
  regression?: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const buttonStyle: React.CSSProperties = {
  background: "#0b4f3a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontWeight: 600,
  cursor: "pointer",
}

const getTrend = (payload: any) => payload?.trend_analysis ?? payload ?? {}

const normalizeDirection = (direction: string | undefined): "alta" | "baixa" | "estavel" => {
  const value = String(direction ?? "").toLowerCase()
  if (["up", "alta", "crescimento"].includes(value)) return "alta"
  if (["down", "baixa", "queda"].includes(value)) return "baixa"
  return "estavel"
}

const parsePoints = (trend: any): TrendPoint[] => {
  const raw = trend.values ?? trend.series ?? trend.data_points ?? []
  if (!Array.isArray(raw)) return []
  const slope = Number(trend.slope)
  const intercept = Number(trend.intercept)
  return raw
    .map((item: any, index: number) => {
      const value = Number(typeof item === "number" ? item : item.value ?? item.y)
      const pointIndex = Number(item.index ?? index)
      return {
        index: pointIndex,
        value,
        regression: Number.isFinite(slope) && Number.isFinite(intercept) ? intercept + slope * pointIndex : undefined,
      }
    })
    .filter((point) => Number.isFinite(point.value))
}

export const TendenciasDashboard: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [columns, setColumns] = useState<string[]>([])
  const [selectedColumn, setSelectedColumn] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`${API_URL}/api/advanced/${sessionId}/columns`)
      .then((response) => {
        if (!response.ok) throw new Error("columns")
        return response.json()
      })
      .then((data) => {
        if (!alive) return
        const numeric = data.numeric_columns ?? []
        setColumns(numeric)
        setSelectedColumn((current) => current || numeric[0] || "")
      })
      .catch(() => setError("Erro ao carregar dados."))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [sessionId])

  const analyze = async () => {
    if (!selectedColumn) return
    setLoading(true)
    setError(null)
    try {
      let response = await fetch(`${API_URL}/api/advanced/${sessionId}/trends?column=${encodeURIComponent(selectedColumn)}&window=5`)
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/advanced/${sessionId}/trends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column: selectedColumn, window: 5 }),
        })
      }
      if (!response.ok) throw new Error("trends")
      setResult(await response.json())
    } catch {
      setError("Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  const trend = useMemo(() => getTrend(result), [result])
  const direction = normalizeDirection(trend.direction)
  const chartData = useMemo(() => parsePoints(trend), [trend])
  const r2 = Number(trend.r_squared ?? trend.r2 ?? 0)
  const strength = trend.strength ?? (r2 > 0.7 ? "forte" : r2 > 0.4 ? "moderada" : "fraca")
  const interpretation = r2 > 0.7 ? "Tendência forte e confiável" : r2 > 0.4 ? "Tendência moderada" : "Tendência fraca ou dados dispersos"
  const badgeColor = direction === "alta" ? "#16a34a" : direction === "baixa" ? "#ef4444" : "#64748b"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Tendências & Previsão</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Avalie direção, força e consistência de evolução dos indicadores do ERP.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 700, fontSize: 12 }}>
            Coluna numérica
            <select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 240 }}>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <button type="button" onClick={analyze} disabled={!selectedColumn || loading} style={{ ...buttonStyle, opacity: !selectedColumn || loading ? 0.6 : 1 }}>
            Analisar
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Carregando...</p>}
      {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>}
      {!loading && !result && <div style={cardStyle}><p style={{ margin: 0, color: "#64748b" }}>Selecione uma coluna numérica para analisar tendências</p></div>}

      {result && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...cardStyle, minWidth: 160 }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 800 }}>DIREÇÃO</p>
              <span style={{ display: "inline-block", marginTop: 8, padding: "5px 10px", borderRadius: 999, color: "#fff", background: badgeColor, fontWeight: 800 }}>
                {direction.toUpperCase()}
              </span>
            </div>
            {[
              ["Inclinação", trend.slope],
              ["R²", r2],
              ["Força", strength],
              ["Média Recente", trend.recent_average ?? trend.recent_avg],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ ...cardStyle, minWidth: 150, flex: 1 }}>
                <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</p>
                <p style={{ margin: "8px 0 0", color: "#0b4f3a", fontSize: 24, fontWeight: 800 }}>{value ?? "-"}</p>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <p style={{ margin: 0, color: "#0f172a", fontWeight: 800 }}>{interpretation}</p>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Série analisada</h3>
            {chartData.length === 0 ? (
              <p style={{ color: "#64748b" }}>Sem pontos suficientes para o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="index" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="value" stroke="#0b4f3a" strokeWidth={3} dot={false} name="Valor" />
                  {chartData.some((point) => point.regression !== undefined) && (
                    <Line type="monotone" dataKey="regression" stroke="#cbbba0" strokeWidth={2} dot={false} name="Regressão" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {(trend.seasonal_strength || trend.seasonality) && (
            <div style={cardStyle}>
              <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 800 }}>SAZONALIDADE</p>
              <p style={{ margin: "8px 0 0", color: "#0b4f3a", fontSize: 24, fontWeight: 800 }}>
                {trend.seasonal_strength ?? trend.seasonality}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
