import type React from "react"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { emptyStateStyle, lightCardStyle, lightTdStyle, lightThStyle, lightTitleStyle } from "./styles"

interface Props {
  evolutionData: Array<{ periodo: string; mes: number; funcionarios: number }>
}

const EvolutionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#94a3b8", margin: "0 0 6px", fontWeight: 700 }}>{label}</p>
      <p style={{ color: "#f1f5f9", margin: 0 }}>
        Headcount: <strong>{payload[0].value}</strong>
      </p>
    </div>
  )
}

export function EfetivoEvolucao({ evolutionData }: Props) {
  if (evolutionData.length < 2) {
    return (
      <div style={lightCardStyle}>
        <h3 style={lightTitleStyle}>Evolução do Headcount</h3>
        <p style={emptyStateStyle}>Não foi encontrada uma coluna de data/competência para evolução.</p>
      </div>
    )
  }

  const firstPoint = evolutionData[0]
  const lastPoint = evolutionData[evolutionData.length - 1]
  const peak = evolutionData.reduce((max, point) => (point.funcionarios > max.funcionarios ? point : max), firstPoint)
  const trough = evolutionData.reduce((min, point) => (point.funcionarios < min.funcionarios ? point : min), firstPoint)
  const deltaFirst = lastPoint.funcionarios - firstPoint.funcionarios
  const deltaPct = firstPoint.funcionarios > 0 ? ((deltaFirst / firstPoint.funcionarios) * 100).toFixed(1) : null
  const avgHeadcount = Math.round(evolutionData.reduce((sum, point) => sum + point.funcionarios, 0) / evolutionData.length)
  const deltaColor = deltaFirst >= 0 ? "#4f8ef7" : "#e05263"
  const deltaLabel = `${deltaFirst > 0 ? "+" : ""}${deltaFirst}${deltaPct !== null ? ` (${deltaPct}%)` : ""}`

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Pico", value: peak.funcionarios, subtitle: peak.periodo, color: "#34c97e" },
          { label: "Vale", value: trough.funcionarios, subtitle: trough.periodo, color: "#f5a623" },
          { label: "Variação Total", value: deltaLabel, subtitle: `${firstPoint.periodo} → ${lastPoint.periodo}`, color: deltaColor },
        ].map((card) => (
          <div key={card.label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${card.color}30`, borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {card.label}
            </p>
            <p style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div style={lightCardStyle}>
        <h3 style={lightTitleStyle}>Evolução do Headcount</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={evolutionData} margin={{ top: 8, right: 28, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" interval={0} tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={8} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<EvolutionTooltip />} />
            <ReferenceLine
              y={avgHeadcount}
              stroke="#64748b"
              strokeDasharray="5 5"
              label={{ value: `Média: ${avgHeadcount}`, position: "right", fill: "#64748b", fontSize: 10 }}
            />
            <ReferenceDot
              x={peak.periodo}
              y={peak.funcionarios}
              r={6}
              fill="#34c97e"
              stroke="#34c97e"
              label={{ value: "↑ Pico", position: "top", fill: "#34c97e", fontSize: 10 }}
            />
            <ReferenceDot
              x={trough.periodo}
              y={trough.funcionarios}
              r={6}
              fill="#f5a623"
              stroke="#f5a623"
              label={{ value: "↓ Vale", position: "bottom", fill: "#f5a623", fontSize: 10 }}
            />
            <Line type="monotone" dataKey="funcionarios" stroke="#0b4f3a" strokeWidth={3} dot={{ r: 4, fill: "#0b4f3a" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={lightCardStyle}>
        <h3 style={lightTitleStyle}>Resumo Mensal</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ cursor: "default" }}>
                <th style={lightThStyle}>Mês</th>
                <th style={{ ...lightThStyle, textAlign: "right" }}>Funcionários</th>
                <th style={{ ...lightThStyle, textAlign: "right" }}>Δ vs anterior</th>
              </tr>
            </thead>
            <tbody>
              {evolutionData.map((row, index) => {
                const previous = evolutionData[index - 1]
                const delta = previous ? row.funcionarios - previous.funcionarios : null
                const deltaText = delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`
                const deltaTextColor = delta === null ? "#64748b" : delta >= 0 ? "#34c97e" : "#e05263"

                return (
                  <tr key={row.periodo} style={{ cursor: "default" }}>
                    <td style={lightTdStyle}>{row.periodo}</td>
                    <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.funcionarios}</td>
                    <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 700, color: deltaTextColor }}>{deltaText}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
