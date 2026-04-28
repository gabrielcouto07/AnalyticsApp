"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { API_BASE_URL } from "../api/client"

interface AnalyticsProps {
  sessionId: string
}

type SegmentMethod = "quartiles" | "threshold"

type SegmentRow = {
  name: string
  count: number
  percentage: number
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

const normalizeSegments = (payload: any): SegmentRow[] => {
  const analysis = payload?.segmentation_analysis ?? payload ?? {}
  const rawSegments = analysis.segments ?? analysis.counts ?? {}
  const total = Number(analysis.total ?? analysis.total_records ?? 0)

  if (Array.isArray(rawSegments)) {
    return rawSegments.map((row: any) => ({
      name: String(row.name ?? row.segment ?? row.label ?? "-"),
      count: Number(row.count ?? row.value ?? 0),
      percentage: Number(row.percentage ?? row.percent ?? 0),
    }))
  }

  if (rawSegments && typeof rawSegments === "object") {
    const percentages = analysis.percentages ?? {}
    const rows = Object.entries(rawSegments).map(([name, count]) => ({
      name,
      count: Number(count) || 0,
      percentage: Number(percentages[name]) || 0,
    }))
    const computedTotal = total || rows.reduce((sum, row) => sum + row.count, 0)
    return rows.map((row) => ({
      ...row,
      percentage: row.percentage || (computedTotal ? Number(((row.count / computedTotal) * 100).toFixed(1)) : 0),
    }))
  }

  return []
}

export const SegmentacaoDashboard: React.FC<AnalyticsProps> = ({ sessionId }) => {
  const [columns, setColumns] = useState<string[]>([])
  const [selectedColumn, setSelectedColumn] = useState("")
  const [method, setMethod] = useState<SegmentMethod>("quartiles")
  const [thresholds, setThresholds] = useState("")
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

  const segment = async () => {
    if (!selectedColumn) return
    setLoading(true)
    setError(null)
    try {
      let response = await fetch(`${API_URL}/api/advanced/${sessionId}/segmentation?column=${encodeURIComponent(selectedColumn)}&method=${method}&thresholds=${encodeURIComponent(thresholds)}`)
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/advanced/${sessionId}/segmentation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            column: selectedColumn,
            method,
            thresholds: thresholds ? thresholds.split(",").map((value) => Number(value.trim())).filter(Number.isFinite) : null,
          }),
        })
      }
      if (!response.ok) throw new Error("segmentation")
      setResult(await response.json())
    } catch {
      setError("Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }

  const rows = useMemo(() => normalizeSegments(result), [result])
  const total = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#0f172a" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>Segmentação de Dados</h2>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Agrupe registros por faixas para comparar custos, materiais, orçamento, efetivo ou produtividade.
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
          <div style={{ display: "flex", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
            {([
              ["quartiles", "Por Quartis"],
              ["threshold", "Por Threshold"],
            ] as Array<[SegmentMethod, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                style={{
                  border: "none",
                  padding: "9px 12px",
                  background: method === value ? "#0b4f3a" : "#fff",
                  color: method === value ? "#fff" : "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {method === "threshold" && (
            <input
              value={thresholds}
              onChange={(event) => setThresholds(event.target.value)}
              placeholder="Ex: 100, 500, 1000"
              style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 200 }}
            />
          )}
          <button type="button" onClick={segment} disabled={!selectedColumn || loading} style={{ ...buttonStyle, opacity: !selectedColumn || loading ? 0.6 : 1 }}>
            Segmentar
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Carregando...</p>}
      {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>}
      {!loading && !result && <div style={cardStyle}><p style={{ margin: 0, color: "#64748b" }}>Selecione uma coluna e método para segmentar</p></div>}

      {result && (
        <>
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Registros por segmento</h3>
            {rows.length === 0 ? (
              <p style={{ color: "#64748b" }}>Nenhum segmento encontrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="count" fill="#0b4f3a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Segmento</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Qtd</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td style={tdStyle}>{row.name}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.count.toLocaleString("pt-BR")}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.percentage.toLocaleString("pt-BR")}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>Total</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{total.toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>100%</td>
                  </tr>
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
