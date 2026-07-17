import Plot from "react-plotly.js"
import { tokens } from "../../lib/theme"
import { fmt } from "../../lib/format"

export interface MonthPoint {
  mes: number
  saida: number
  entrada: number
  saida_ano_anterior: number
}

interface Props {
  data: MonthPoint[]
  ano: number
  height?: number
}

/**
 * Evolução mensal: Saída × Entrada (barras, par de cores validado p/ CVD)
 * + Saída do ano anterior como série de referência (cinza tracejado — a
 * identidade vem do rótulo na legenda, não do matiz). Um único eixo (R$).
 */
export function MonthlyChart({ data, ano, height = 380 }: Props) {
  const meses = data.map(d => fmt.monthShort(d.mes))
  const hover = (serie: string) =>
    `${serie} · %{x}<br><b>%{customdata}</b><extra></extra>`

  return (
    // @ts-ignore - Plotly type definitions issue
    <Plot
      data={[
        {
          x: meses,
          y: data.map(d => d.saida),
          customdata: data.map(d => fmt.currency(d.saida)),
          type: "bar",
          name: `Saída ${ano}`,
          marker: { color: tokens.viz.pair.saida },
          hovertemplate: hover(`Saída ${ano}`),
        },
        {
          x: meses,
          y: data.map(d => d.entrada),
          customdata: data.map(d => fmt.currency(d.entrada)),
          type: "bar",
          name: `Entrada ${ano}`,
          marker: { color: tokens.viz.pair.entrada },
          hovertemplate: hover(`Entrada ${ano}`),
        },
        {
          x: meses,
          y: data.map(d => d.saida_ano_anterior),
          customdata: data.map(d => fmt.currency(d.saida_ano_anterior)),
          type: "scatter",
          mode: "lines+markers",
          name: `Saída ${ano - 1} (referência)`,
          line: { color: tokens.viz.reference, width: 2, dash: "dash" },
          marker: { size: 6, color: tokens.viz.reference },
          hovertemplate: hover(`Saída ${ano - 1}`),
        },
      ]}
      layout={{
        ...tokens.plotly.layout,
        height,
        barmode: "group",
        bargap: 0.25,
        bargroupgap: 0.08,
        margin: { l: 64, r: 16, t: 8, b: 40 },
        hovermode: "x unified",
        xaxis: { ...tokens.plotly.layout.xaxis, fixedrange: true },
        yaxis: {
          ...tokens.plotly.layout.yaxis,
          tickformat: "~s",
          rangemode: "tozero",
          fixedrange: true,
        },
        legend: {
          bgcolor: "rgba(0,0,0,0)",
          font: { color: tokens.colors.muted, size: 11 },
          orientation: "h",
          x: 0,
          y: 1.12,
        },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  )
}
