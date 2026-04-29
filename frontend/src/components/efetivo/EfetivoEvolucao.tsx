import React, { useEffect, useMemo, useState } from "react"

import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { useSessionStore } from "../../store/session"
import { buildEvolutionData, buildWorkRows, fetchEfetivoBase } from "./data"

function EvolucaoSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
      <div style={panelSkeletonStyle} />
      <div style={panelSkeletonStyle} />
      <style>{skeletonStyle}</style>
    </div>
  )
}

export function EfetivoEvolucao({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evolutionData, setEvolutionData] = useState<Array<{ periodo: string; mes: number; funcionarios: number }>>(
    [],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchEfetivoBase(sessionId)
      .then((base) => {
        if (!active) return
        setEvolutionData(buildEvolutionData(buildWorkRows(base.summary, base.months)))
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar a evolução do efetivo.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const analytics = useMemo(() => {
    if (evolutionData.length < 2) return null
    const firstPoint = evolutionData[0]
    const lastPoint = evolutionData[evolutionData.length - 1]
    const peak = evolutionData.reduce((max, point) =>
      point.funcionarios > max.funcionarios ? point : max,
    )
    const trough = evolutionData.reduce((min, point) =>
      point.funcionarios < min.funcionarios ? point : min,
    )
    const delta = lastPoint.funcionarios - firstPoint.funcionarios
    const avgHeadcount = Math.round(
      evolutionData.reduce((sum, point) => sum + point.funcionarios, 0) / evolutionData.length,
    )
    return { firstPoint, lastPoint, peak, trough, delta, avgHeadcount }
  }, [evolutionData])

  if (loading) return <EvolucaoSkeleton />

  if (error || !analytics) {
    return (
      <EmptyState
        schemaRequired="efetivo"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.efetivo}
        uploadedSchemas={uploadedSchemas}
      />
    )
  }

  const deltaPct =
    analytics.firstPoint.funcionarios > 0
      ? ((analytics.delta / analytics.firstPoint.funcionarios) * 100).toFixed(1)
      : null
  const deltaColor = analytics.delta >= 0 ? "#4f8ef7" : "#e05263"
  const lastPoint = evolutionData[evolutionData.length - 1]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Pico", value: analytics.peak.funcionarios, subtitle: analytics.peak.periodo, color: "#34c97e" },
          { label: "Vale", value: analytics.trough.funcionarios, subtitle: analytics.trough.periodo, color: "#f5a623" },
          {
            label: "Variação Total",
            value: `${analytics.delta > 0 ? "+" : ""}${analytics.delta}${deltaPct ? ` (${deltaPct}%)` : ""}`,
            subtitle: `${analytics.firstPoint.periodo} → ${analytics.lastPoint.periodo}`,
            color: deltaColor,
          },
        ].map((card) => (
          <div key={card.label} style={metricCardStyle}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              {card.label}
            </p>
            <p style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>{card.subtitle}</p>
          </div>
        ))}
      </div>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Evolução do Headcount</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={evolutionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <ReferenceLine
              y={analytics.avgHeadcount}
              stroke="#64748b"
              strokeDasharray="5 5"
              label={{ value: `Média: ${analytics.avgHeadcount}`, position: "right", fill: "#64748b", fontSize: 10 }}
            />
            <ReferenceDot x={analytics.peak.periodo} y={analytics.peak.funcionarios} r={6} fill="#34c97e" stroke="#34c97e" />
            <ReferenceDot x={analytics.trough.periodo} y={analytics.trough.funcionarios} r={6} fill="#f5a623" stroke="#f5a623" />
            <ReferenceDot x={lastPoint.periodo} y={lastPoint.funcionarios} r={5} fill="#0b4f3a" stroke="#0b4f3a">
              <Label value={lastPoint.funcionarios} position="top" fontSize={11} />
            </ReferenceDot>
            <Line
              type="monotone"
              dataKey="funcionarios"
              stroke="#0b4f3a"
              strokeWidth={3}
              dot={{ r: 4, fill: "#0b4f3a" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Resumo Mensal</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Mês</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Funcionários</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Δ vs anterior</th>
              </tr>
            </thead>
            <tbody>
              {evolutionData.map((row, index) => {
                const previous = evolutionData[index - 1]
                const delta = previous ? row.funcionarios - previous.funcionarios : null
                const deltaText = delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`
                const deltaTextColor = delta === null ? "#64748b" : delta >= 0 ? "#34c97e" : "#e05263"

                return (
                  <tr key={row.periodo}>
                    <td style={tdStyle}>{row.periodo}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.funcionarios}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: deltaTextColor }}>{deltaText}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const skeletonStyle = `
  @keyframes efetivo-evolucao-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const cardSkeletonStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "efetivo-evolucao-wave 1.4s ease infinite",
}

const panelSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 300,
}

const metricCardStyle: React.CSSProperties = {
  background: "rgba(30,41,59,0.7)",
  border: "1px solid rgba(79,142,247,0.12)",
  borderRadius: 12,
  padding: "16px 18px",
}

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
}
