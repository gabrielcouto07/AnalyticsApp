import Plot from "../lib/plotly"
import { tokens } from "../lib/theme"
import { fmt } from "../lib/format"

export interface TemporalPoint {
  date: string
  value: number
  cumulative: number
}

interface Props {
  data: TemporalPoint[]
  metricLabel: string
  /** false = totais por período (barras) · true = acumulado (linha) */
  cumulative?: boolean
  currency?: boolean
  height?: number
}

/**
 * Série temporal com UM eixo. Totais por período OU acumulado — alternados
 * pelo usuário, nunca sobrepostos em dois eixos (anti-pattern nº 1 de dataviz).
 */
export function TemporalChart({ data, metricLabel, cumulative = false, currency = true, height = 400 }: Props) {
  if (!data.length) {
    return <div className="text-center py-8 text-muted text-sm">Sem dados</div>
  }

  const x = data.map(d => d.date)
  const y = data.map(d => (cumulative ? d.cumulative : d.value))
  const labels = y.map(v => (currency ? fmt.currency(v) : fmt.number(v)))

  const serie = cumulative
    ? {
        x, y,
        customdata: labels,
        type: "scatter" as const,
        mode: "lines+markers" as const,
        name: `${metricLabel} (acumulado)`,
        line: { color: tokens.viz.singleHue, width: 2 },
        marker: { size: 6, color: tokens.viz.singleHue },
        fill: "tozeroy" as const,
        fillcolor: "rgba(57, 135, 229, 0.12)",
        hovertemplate: "%{x}<br><b>%{customdata}</b><extra></extra>",
      }
    : {
        x, y,
        customdata: labels,
        type: "bar" as const,
        name: metricLabel,
        marker: { color: tokens.viz.singleHue },
        hovertemplate: "%{x}<br><b>%{customdata}</b><extra></extra>",
      }

  return (
    // @ts-ignore - Plotly type definitions issue
    <Plot
      data={[serie]}
      layout={{
        ...tokens.plotly.layout,
        height,
        margin: { l: 64, r: 16, t: 8, b: 48 },
        showlegend: false,
        hovermode: "x unified",
        xaxis: { ...tokens.plotly.layout.xaxis, fixedrange: true },
        yaxis: {
          ...tokens.plotly.layout.yaxis,
          tickformat: "~s",
          rangemode: "tozero",
          fixedrange: true,
        },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  )
}
