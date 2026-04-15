import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { getCorrelation } from '../api/analytics'

interface CorrelationChartProps {
  sessionId: string
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
  margin: { l: 80, r: 40, t: 40, b: 80 },
}

export function CorrelationChart({ sessionId }: CorrelationChartProps) {
  const [columns, setColumns] = useState<string[]>([])
  const [correlations, setCorrelations] = useState<number[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCorrelation(sessionId)
      .then(result => {
        setColumns(result.columns || [])
        setCorrelations(result.data || [])
      })
      .catch(e => {
        setError('Erro ao carregar correlação')
        console.error(e)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <div className="text-center py-8 text-muted">Carregando correlação...</div>
  if (error) return <div className="text-danger text-center py-8">{error}</div>
  if (!columns.length) return <div className="text-center py-8 text-muted">Sem dados de correlação</div>

  return (
    <Plot
      data={[
        {
          z: correlations,
          x: columns,
          y: columns,
          type: 'heatmap',
          colorscale: [
            [0, '#f87171'], // danger (vermelho)
            [0.5, '#f1f5f9'], // texto (neutro)
            [1, '#34c97e'], // success (verde)
          ],
          colorbar: {
            title: 'Correlação',
            thickness: 20,
            len: 0.7,
            tickfont: { color: '#94a3b8' },
          },
          hovertemplate: '%{y} vs %{x}: %{z:.3f}<extra></extra>',
        },
      ]}
      layout={{
        ...darkLayout,
        title: { text: 'Matriz de Correlação (Pearson)', font: { size: 18, color: '#f1f5f9' } },
        xaxis: { ...darkLayout.xaxis, title: 'Variáveis' },
        yaxis: { ...darkLayout.yaxis, title: 'Variáveis' },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '600px' }}
    />
  )
}
