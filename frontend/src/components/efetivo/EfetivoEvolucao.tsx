import type React from "react"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { emptyStateStyle, lightCardStyle, lightTitleStyle } from "./styles"

interface Props {
  evolutionData: Array<{ periodo: string; mes: number; funcionarios: number }>
}

export function EfetivoEvolucao({ evolutionData }: Props) {
  return (
    <div style={lightCardStyle}>
      <h3 style={lightTitleStyle}>Evolução do Headcount</h3>
      {evolutionData.length < 2 ? (
        <p style={emptyStateStyle}>Não foi encontrada uma coluna de data/competência para evolução.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={evolutionData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" interval={0} tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={8} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: "8px" }} />
            <Line type="monotone" dataKey="funcionarios" stroke="#0b4f3a" strokeWidth={3} dot={{ r: 4, fill: "#0b4f3a" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
