import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { getTemporalChart } from '../api/analytics'

interface TemporalChartProps {
  sessionId: string
  dateCol: string
  metricCol: string
  granularity?: string
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
  yaxis2: {
    gridcolor: '#334155',
    linecolor: '#334155',
    tickfont: { color: '#94a3b8' },
  },
  legend: { bgcolor: 'rgba(0,0,0,0.5)', font: { color: '#94a3b8' }, x: 0, y: 1 },
  margin: { l: 60, r: 60, t: 40, b: 60 },
  hovermode: 'x unified' as const,
}

export function TemporalChart({
  sessionId,
  dateCol,
  metricCol,
  granularity = 'ME',
}: TemporalChartProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getTemporalChart(sessionId, {
      date_col: dateCol,
      metric_col: metricCol,
      granularity,
    })
      .then(result => {
        setData(result.data || [])
      })
      .catch(e => {
        setError('Erro ao carregar gráfico temporal')
        console.error(e)
      })
      .finally(() => setLoading(false))
  }, [sessionId, dateCol, metricCol, granularity])

  if (loading) return <div className="text-center py-8 text-muted">Carregando gráfico...</div>
  if (error) return <div className="text-danger text-center py-8">{error}</div>
  if (!data.length) return <div className="text-center py-8 text-muted">Sem dados</div>

  const dates = data.map(d => d[dateCol])
  const values = data.map(d => d[metricCol])
  const cumulative = data.map(d => d.cumulative || 0)

  return (
    // @ts-ignore - Plotly type definitions issue
    <Plot
      data={[
        {
          x: dates,
          y: values,
          type: 'bar',
          name: `${metricCol} (Total)`,
          marker: { color: '#4f8ef7', line: { color: '#334155', width: 1 } },
          opacity: 0.8,
        },
        {
          x: dates,
          y: cumulative,
          type: 'scatter',
          mode: 'lines+markers',
          name: `${metricCol} (Cumulativo)`,
          line: { color: '#a78bfa', width: 3 },
          marker: { size: 4 },
          yaxis: 'y2',
        },
      ]}
      layout={{
        ...darkLayout,
        title: { text: `Série Temporal: ${metricCol}`, font: { size: 18, color: '#f1f5f9' } },
        xaxis: { ...darkLayout.xaxis, title: dateCol },
        yaxis: { ...darkLayout.yaxis, title: `${metricCol} (Total)`, titlefont: { color: '#4f8ef7' } },
        yaxis2: {
          ...darkLayout.yaxis2,
          title: `${metricCol} (Cumulativo)`,
          overlaying: 'y' as const,
          side: 'right' as const,
          titlefont: { color: '#a78bfa' },
        },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '500px' }}
    />
  )
}
