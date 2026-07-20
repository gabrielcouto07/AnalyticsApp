import { useEffect, useState } from "react"
import Plot from "../lib/plotly"
import { useSession } from "../store/session"
import { getDistribution } from "../api/analytics"
import { ChartCard } from "../components/common"
import { tokens } from "../lib/theme"
import { fmt } from "../lib/format"

interface Bin { x0: number; x1: number; count: number }
interface Stats {
  count: number; mean: number; median: number; std: number
  min: number; max: number; q1: number; q3: number
}

const isPeriodCol = (c: string) => /^(ano|m[êe]s|year|month|dia|day)$/i.test(c)

const selectCls =
  "w-full max-w-xs bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer " +
  "hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"

// Distribuição: histograma + estatísticas descritivas de uma coluna numérica
export function DistributionPage() {
  const { sessionId, colTypes } = useSession()
  const numericColumns = (colTypes?.numeric ?? []).filter(c => !isPeriodCol(c))

  const [column, setColumn] = useState<string>(numericColumns[0] ?? "")
  const [bins, setBins] = useState<Bin[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Normalização: se a coluna selecionada não existe mais nos metadados atuais
  // (troca de sessão/dataset), volta para a primeira válida — nunca consulta o
  // backend com uma coluna da planilha anterior.
  const numericKey = numericColumns.join("|")
  useEffect(() => {
    if (numericColumns.length && !numericColumns.includes(column)) {
      setColumn(numericColumns[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericKey])

  useEffect(() => {
    if (!sessionId || !column || !numericColumns.includes(column)) return
    setLoading(true)
    setError(null)
    getDistribution(sessionId, column, 30)
      .then(r => { setBins(r.bins ?? []); setStats(r.stats ?? null) })
      .catch(e => setError(e?.response?.data?.detail || "Erro ao carregar a distribuição."))
      .finally(() => setLoading(false))
  }, [sessionId, column])

  if (numericColumns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-xl font-bold text-text">Distribuição</h2>
        <div className="bg-card/60 border border-border rounded-xl p-8 text-center text-muted text-sm">
          Nenhuma coluna numérica disponível.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Distribuição</h2>
        <p className="mt-1 mb-0 text-sm text-muted">Histograma e estatísticas descritivas</p>
      </div>

      <div>
        <label htmlFor="dist-col" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Coluna</label>
        <select id="dist-col" className={selectCls} value={column} onChange={e => setColumn(e.target.value)}>
          {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {[
            { label: "Registros", value: fmt.int(stats.count) },
            { label: "Média", value: fmt.number(stats.mean) },
            { label: "Mediana", value: fmt.number(stats.median) },
            { label: "Desvio padrão", value: fmt.number(stats.std) },
            { label: "Mínimo", value: fmt.number(stats.min) },
            { label: "Q1 · Q3", value: `${fmt.compact(stats.q1)} · ${fmt.compact(stats.q3)}` },
            { label: "Máximo", value: fmt.number(stats.max) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card/60 border border-border rounded-xl px-4 py-3">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
              <p className="m-0 mt-1 text-sm font-bold text-text truncate" title={String(value)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Histograma */}
      <ChartCard title={`Histograma de ${column}`} subtitle="30 faixas" loading={loading}>
        {error ? (
          <div className="text-danger text-sm text-center py-8">{error}</div>
        ) : bins.length === 0 ? (
          <div className="text-muted text-sm text-center py-8">Sem dados numéricos nesta coluna</div>
        ) : (
          // @ts-ignore - Plotly type definitions issue
          <Plot
            data={[{
              x: bins.map(b => (b.x0 + b.x1) / 2),
              y: bins.map(b => b.count),
              customdata: bins.map(b => `${fmt.compact(b.x0)} a ${fmt.compact(b.x1)}`),
              type: "bar",
              marker: { color: tokens.viz.singleHue },
              hovertemplate: "%{customdata}<br><b>%{y:,d} registros</b><extra></extra>",
            }]}
            layout={{
              ...tokens.plotly.layout,
              height: 380,
              bargap: 0.06,
              margin: { l: 56, r: 16, t: 8, b: 48 },
              showlegend: false,
              xaxis: { ...tokens.plotly.layout.xaxis, tickformat: "~s", fixedrange: true },
              yaxis: { ...tokens.plotly.layout.yaxis, title: { text: "registros", font: { size: 11, color: "#94a3b8" } }, fixedrange: true },
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
            useResizeHandler
          />
        )}
      </ChartCard>
    </div>
  )
}
