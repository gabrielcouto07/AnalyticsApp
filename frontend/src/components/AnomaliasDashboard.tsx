"use client"

import React, { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import { API_BASE_URL } from "../api/client"
import { fmtPct } from "../lib/formatters"

interface AnalyticsProps {
  sessionId: string
}

interface ColumnResponse {
  numeric_columns?: string[]
}

interface MethodResult {
  method: string
  count: number
  percentage: number
  lower?: number | null
  upper?: number | null
  threshold?: number | null
}

interface Point {
  index: number
  value: number
  is_anomaly?: boolean
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

const valueOf = (obj: any, keys: string[], fallback: any = undefined) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key]
  }
  return fallback
}

const parseMethodResults = (payload: any): MethodResult[] => {
  const analysis = payload?.anomaly_analysis ?? payload ?? {}
  return Object.entries(analysis)
    .filter(([, value]) => value && typeof value === "object")
    .map(([key, value]: [string, any]) => {
      const anomalies = value.anomalies
      const count = Number(valueOf(value, ["anomaly_count", "count"], Array.isArray(anomalies) ? anomalies.length : anomalies ?? 0)) || 0
      const percentage = Number(valueOf(value, ["anomaly_pct", "percentage"], 0)) || 0
      const bounds = value.bounds ?? {}
      return {
        method: String(value.method ?? key).replace("_", " "),
        count,
        percentage,
        lower: valueOf(value, ["lower_bound"], bounds.lower ?? null),
        upper: valueOf(value, ["upper_bound"], bounds.upper ?? null),
        threshold: valueOf(value, ["threshold", "threshold_multiplier", "contamination_threshold"], null),
      }
    })
}

const parsePoints = (payload: any): Point[] => {
  const raw = payload?.data_points ?? payload?.points ?? payload?.series ?? []
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: any, index: number) => ({
      index: Number(item.index ?? index),
      value: Number(item.value ?? item.valor ?? item.y),
      is_anomaly: Boolean(item.is_anomaly ?? item.anomaly),
    }))
    .filter((point) => Number.isFinite(point.value))
}

export const AnomaliasDashboard: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [columns, setColumns] = useState<string[]>([])
  const [selectedColumn, setSelectedColumn] = useState("")
  const [methods, setMethods] = useState<string[]>(["iqr", "zscore"])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`${API_URL}/api/advanced/${sessionId}/columns`)
      .then((response) => {
        if (!response.ok) throw new Error("columns")
        return response.json() as Promise<ColumnResponse>
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
      const methodsCsv = methods.join(",")
      let response = await fetch(`${API_URL}/api/advanced/${sessionId}/anomalies?column=${encodeURIComponent(selectedColumn)}&methods=${encodeURIComponent(methodsCsv)}`)
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/advanced/${sessionId}/anomalies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column: selectedColumn, methods }),
        })
      }
      if (!response.ok) throw new Error("anomalies")
      setResult(await response.json())
    } catch {
      setError("Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  const methodResults = useMemo(() => parseMethodResults(result), [result])
  const points = useMemo(() => parsePoints(result), [result])
  const anomalyCount = points.filter((point) => point.is_anomaly).length || Math.max(0, ...methodResults.map((item) => item.count))
  const total = points.length || Number(valueOf(result?.anomaly_analysis, ["total_records"], 0)) || 0
  const anomalyPct = total ? (anomalyCount / total) * 100 : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Detecção de Anomalias</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Identifique valores fora do padrão em custos, efetivo, orçamento, materiais ou indicadores de obra.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 700, fontSize: 12 }}>
            Coluna numérica
            <select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 220 }}>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          {[
            ["iqr", "IQR"],
            ["zscore", "Z-Score"],
            ["isolation_forest", "Isolation Forest"],
          ].map(([value, label]) => (
            <label key={value} style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={methods.includes(value)}
                onChange={(event) => setMethods((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))}
              />
              {label}
            </label>
          ))}
          <button type="button" onClick={analyze} disabled={!selectedColumn || loading} style={{ ...buttonStyle, opacity: !selectedColumn || loading ? 0.6 : 1 }}>
            Analisar
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Carregando...</p>}
      {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>}
      {!loading && !result && <div style={cardStyle}><p style={{ margin: 0, color: "#64748b" }}>Selecione uma coluna para começar</p></div>}

      {result && (
        <>
          <div style={cardStyle}>
            <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>Resumo</p>
            <p style={{ margin: "6px 0 0", color: "#0b4f3a", fontSize: 28, fontWeight: 800 }}>
              {anomalyCount} anomalias detectadas ({fmtPct(anomalyPct)} dos dados)
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {methodResults.map((method) => (
              <div key={method.method} style={cardStyle}>
                <p style={{ margin: 0, fontWeight: 800, color: "#0f172a", textTransform: "capitalize" }}>{method.method}</p>
                <p style={{ margin: "8px 0 0", color: "#0b4f3a", fontSize: 24, fontWeight: 800 }}>{method.count}</p>
                <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{method.percentage}% dos registros</p>
                {method.lower !== null && method.upper !== null && method.lower !== undefined && method.upper !== undefined && (
                  <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 12 }}>Limites: {method.lower} a {method.upper}</p>
                )}
                {method.threshold !== null && method.threshold !== undefined && (
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Threshold: {method.threshold}</p>
                )}
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Pontos analisados</h3>
            {points.length === 0 ? (
              <p style={{ color: "#64748b" }}>Sem pontos suficientes para o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="index" name="Índice" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis dataKey="value" name={selectedColumn} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Scatter data={points}>
                    {points.map((point, index) => <Cell key={index} fill={point.is_anomaly ? "#ef4444" : "#0b4f3a"} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Primeiras anomalias</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Índice</th>
                    <th style={thStyle}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {points.filter((point) => point.is_anomaly).slice(0, 20).map((point) => (
                    <tr key={`${point.index}-${point.value}`}>
                      <td style={tdStyle}>{point.index}</td>
                      <td style={tdStyle}>{point.value}</td>
                    </tr>
                  ))}
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
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
}
