import Plot from "react-plotly.js"
import { tokens } from "../../lib/theme"
import { fmt } from "../../lib/format"

export interface NameValue {
  name: string
  value: number
}

interface Props {
  data: NameValue[]
  /** Formato dos valores (eixo/tooltip) */
  format?: "currency" | "number"
  height?: number
}

const truncate = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

/**
 * Barras horizontais de magnitude por categoria.
 * Um único matiz — a identidade da categoria já está no eixo; colorir por
 * valor/categoria seria redundante (anti-pattern de dataviz).
 */
export function HBarChart({ data, format = "currency", height = 360 }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-muted text-sm" style={{ height }}>
        Sem dados para o período selecionado
      </div>
    )
  }

  // topo = maior valor; Plotly desenha de baixo pra cima, então invertemos
  const ordered = [...data].reverse()
  const names = ordered.map(d => truncate(d.name))
  const fullNames = ordered.map(d => d.name)
  const values = ordered.map(d => d.value)
  const valueLabel = format === "currency"
    ? ordered.map(d => fmt.currencyCompact(d.value))
    : ordered.map(d => fmt.compact(d.value))

  return (
    // @ts-ignore - Plotly type definitions issue
    <Plot
      data={[{
        x: values,
        y: names,
        customdata: fullNames.map((n, i) => [n, format === "currency" ? fmt.currency(values[i]) : fmt.number(values[i])]),
        type: "bar",
        orientation: "h",
        marker: { color: tokens.viz.singleHue, line: { width: 0 } },
        text: valueLabel,
        textposition: "outside",
        textfont: { color: tokens.colors.muted, size: 11 },
        cliponaxis: false,
        hovertemplate: "%{customdata[0]}<br><b>%{customdata[1]}</b><extra></extra>",
      }]}
      layout={{
        ...tokens.plotly.layout,
        height,
        bargap: 0.35,
        margin: { l: 170, r: 70, t: 8, b: 32 },
        xaxis: {
          ...tokens.plotly.layout.xaxis,
          tickformat: "~s",
          zeroline: false,
          fixedrange: true,
        },
        yaxis: {
          ...tokens.plotly.layout.yaxis,
          gridcolor: "rgba(0,0,0,0)",
          automargin: true,
          fixedrange: true,
        },
        showlegend: false,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  )
}
