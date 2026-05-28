import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { getCrossChart } from '../api/analytics'

interface CrossChartProps {
  sessionId: string
  catCol: string
  numCol: string
  aggFn?: string
  topN?: number
}

interface DataPoint {
  [key: string]: any
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
  margin: { l: 60, r: 20, t: 40, b: 100 },
  hovermode: 'closest' as const,
}

export function CrossChart({
  sessionId,
  catCol,
  numCol,
  aggFn = 'sum',
  topN = 20,
}: CrossChartProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCrossChart(sessionId, {
      cat_col: catCol,
      num_col: numCol,
      agg_fn: aggFn,
      top_n: topN,
    })
      .then(result => {
        setData(result.data || [])
      })
      .catch(e => {
        setError('Erro ao carregar gráfico cruzado')
        console.error(e)
      })
      .finally(() => setLoading(false))
  }, [sessionId, catCol, numCol, aggFn, topN])

  if (loading) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>⏳ Loading chart...</div>
  if (error) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#ef4444" }}>❌ {error}</div>
  if (!data.length) return <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>No data</div>

  const categories = data.map(d => d[catCol])
  const values = data.map(d => d[aggFn])

  return (
    // @ts-ignore - Plotly type definitions issue-ignore - Plotly type definitions issue
    <Plot
      data={[
        {
          x: categories,
          y: values,
          type: 'bar',
          marker: {
            color: values,
            colorscale: [
              [0, '#f87171'],
              [0.5, '#4f8ef7'],
              [1, '#34c97e'],
            ],
            line: { color: '#334155', width: 1 },
          },
          hovertemplate: '%{x}: %{y:,.0f}<extra></extra>',
        },
      ]}
      layout={{
        ...darkLayout,
        title: { text: `${aggFn.toUpperCase()}: ${numCol} por ${catCol}`, font: { size: 18, color: '#f1f5f9' } },
        xaxis: { ...darkLayout.xaxis, title: catCol },
        yaxis: { ...darkLayout.yaxis, title: `${numCol} (${aggFn})` },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '500px' }}
    />
  )
}
