import Plot from "react-plotly.js"
import { tokens } from "../lib/theme"

interface Props {
  columns: string[]
  matrix: (number | null)[][]
  height?: number
}

/**
 * Heatmap de correlação (Pearson). Escala divergente: dois matizes com
 * ponto médio NEUTRO em 0 (nunca um matiz no meio), fixada em [-1, 1].
 */
export function CorrelationChart({ columns, matrix, height = 560 }: Props) {
  if (!columns.length) {
    return <div className="text-center py-8 text-muted text-sm">Sem colunas numéricas suficientes</div>
  }

  return (
    // @ts-ignore - Plotly type definitions issue
    <Plot
      data={[
        {
          z: matrix,
          x: columns,
          y: columns,
          type: "heatmap",
          zmin: -1,
          zmax: 1,
          colorscale: [
            [0, "#3987e5"],    // -1 · azul
            [0.5, "#334155"],  //  0 · neutro (superfície)
            [1, "#d95926"],    // +1 · laranja
          ],
          xgap: 2,
          ygap: 2,
          colorbar: {
            title: { text: "r", font: { color: tokens.colors.muted } },
            thickness: 14,
            len: 0.7,
            tickfont: { color: tokens.colors.muted },
            outlinewidth: 0,
          },
          hovertemplate: "%{y} × %{x}<br><b>r = %{z:.3f}</b><extra></extra>",
        },
      ]}
      layout={{
        ...tokens.plotly.layout,
        height,
        margin: { l: 140, r: 20, t: 8, b: 120 },
        xaxis: { ...tokens.plotly.layout.xaxis, tickangle: -35, automargin: true, fixedrange: true },
        yaxis: { ...tokens.plotly.layout.yaxis, automargin: true, fixedrange: true },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  )
}
