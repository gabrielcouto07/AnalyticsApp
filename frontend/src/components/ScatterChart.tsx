import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'

interface ScatterChartProps {
  sessionId: string
  xCol: string
  yCol: string
  colorCol?: string
}

const darkLayout = {
  paper_bgcolor: '#0f172a',
  plot_bgcolor: '#1e293b',
  font: { family: 'Inter, sans-serif', color: '#f1f5f9', size: 12 },
  xaxis: {
    gridcolor: '#334155',
    linecolor: '#334155',
    tickfont: { color: '#94a3b8' },
  },
  yaxis: {
    gridcolor: '#334155',
    linecolor: '#334155',
    tickfont: { color: '#94a3b8' },
  },
  legend: { bgcolor: 'rgba(0,0,0,0.5)', font: { color: '#94a3b8' } },
  margin: { l: 60, r: 20, t: 40, b: 60 },
  hovermode: 'closest' as const,
}

export function ScatterChart({ sessionId, xCol, yCol, colorCol }: ScatterChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // Mock data for scatter
    const mockData = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: Math.random() * 50,
    }))

    setData(mockData)
    setLoading(false)
  }, [sessionId, xCol, yCol, colorCol])

  if (loading) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>⏳ Loading scatter...</div>
  if (error) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#ef4444" }}>❌ {error}</div>
  if (!data.length) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>No data</div>

  const xValues = data.map((d) => d.x)
  const yValues = data.map((d) => d.y)
  const colors = data.map((d) => d.color)

  return (
    // @ts-ignore - Plotly type definitions issue-ignore - Plotly type definitions issue
    <Plot
      data={[
        {
          x: xValues,
          y: yValues,
          mode: 'markers',
          type: 'scatter',
          marker: {
            size: 8,
            color: colors,
            colorscale: 'Viridis',
            showscale: true,
            colorbar: { title: colorCol || 'Valor', thickness: 15 },
            line: { color: '#94a3b8', width: 0.5 },
          },
          text: data.map(
            (d) => `${xCol}: ${d.x.toFixed(2)}<br>${yCol}: ${d.y.toFixed(2)}<br>Cor: ${d.color.toFixed(2)}`
          ),
          hovertemplate: '%{text}<extra></extra>',
        },
      ]}
      layout={{
        ...darkLayout,
        title: `${xCol} vs ${yCol}`,
        xaxis: { ...darkLayout.xaxis, title: xCol },
        yaxis: { ...darkLayout.yaxis, title: yCol },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '500px' }}
    />
  )
}
