import { useEffect, useMemo, useState } from "react"
import { useSession } from "../store/session"
import { getTemporalChart } from "../api/analytics"
import { TemporalChart, type TemporalPoint } from "../components/TemporalChart"
import { ChartCard } from "../components/common"
import { fmt } from "../lib/format"

const GRANULARITIES = [
  { id: "D", label: "Dia" },
  { id: "W", label: "Semana" },
  { id: "ME", label: "Mês" },
  { id: "QE", label: "Trimestre" },
  { id: "YE", label: "Ano" },
] as const

const isPeriodCol = (c: string) => /^(ano|m[êe]s|year|month|dia|day)$/i.test(c)
const isCurrencyCol = (c: string) => /valor|total|receita|fatur|preço|preco|r\$/i.test(c)

const selectCls =
  "w-full bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer " +
  "hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"

// Análise temporal: série agregada por período, com granularidade e acumulado
export function TemporalPage() {
  const { sessionId, colTypes } = useSession()
  const dateColumns = colTypes?.date ?? []
  // monetárias primeiro — são a métrica padrão mais útil
  const numericColumns = (colTypes?.numeric ?? [])
    .filter(c => !isPeriodCol(c))
    .sort((a, b) => Number(isCurrencyCol(b)) - Number(isCurrencyCol(a)))

  const [dateCol, setDateCol] = useState<string>(dateColumns[0] ?? "")
  const [metricCol, setMetricCol] = useState<string>(numericColumns[0] ?? "")
  const [granularity, setGranularity] = useState<string>("ME")
  const [cumulative, setCumulative] = useState(false)
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Normalização: reseta colunas selecionadas ausentes nos metadados atuais
  const dateKey = dateColumns.join("|")
  const numKey = numericColumns.join("|")
  useEffect(() => {
    if (dateColumns.length && !dateColumns.includes(dateCol)) setDateCol(dateColumns[0])
    if (numericColumns.length && !numericColumns.includes(metricCol)) setMetricCol(numericColumns[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, numKey])

  useEffect(() => {
    if (!sessionId || !dateCol || !metricCol) return
    if (!dateColumns.includes(dateCol) || !numericColumns.includes(metricCol)) return
    setLoading(true)
    setError(null)
    getTemporalChart(sessionId, { date_col: dateCol, metric_col: metricCol, granularity })
      .then(r => setRows(r.data ?? []))
      .catch(e => setError(e?.response?.data?.detail || "Erro ao carregar a série temporal."))
      .finally(() => setLoading(false))
  }, [sessionId, dateCol, metricCol, granularity])

  const data: TemporalPoint[] = useMemo(
    () => rows.map(r => ({
      date: String(r[dateCol]),
      value: Number(r[metricCol] ?? 0),
      cumulative: Number(r.cumulative ?? 0),
    })),
    [rows, dateCol, metricCol],
  )

  const stats = useMemo(() => {
    if (!data.length) return null
    const total = data.reduce((a, b) => a + b.value, 0)
    return {
      range: `${fmt.date(data[0].date)} – ${fmt.date(data[data.length - 1].date)}`,
      periods: data.length,
      total,
      avg: total / data.length,
    }
  }, [data])

  const currency = isCurrencyCol(metricCol)

  if (dateColumns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-xl font-bold text-text">Análise Temporal</h2>
        <div className="bg-card/60 border border-border rounded-xl p-8 text-center text-muted text-sm">
          Nenhuma coluna de data detectada neste dataset.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Análise Temporal</h2>
        <p className="mt-1 mb-0 text-sm text-muted">Tendências e padrões ao longo do tempo</p>
      </div>

      {/* Controles */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <label htmlFor="temporal-date" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Coluna de data</label>
          <select id="temporal-date" className={selectCls} value={dateCol} onChange={e => setDateCol(e.target.value)}>
            {dateColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="temporal-metric" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Métrica</label>
          <select id="temporal-metric" className={selectCls} value={metricCol} onChange={e => setMetricCol(e.target.value)}>
            {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Granularidade</span>
          <div className="flex gap-1.5" role="group" aria-label="Granularidade">
            {GRANULARITIES.map(g => (
              <button
                key={g.id}
                onClick={() => setGranularity(g.id)}
                aria-pressed={granularity === g.id}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer
                  ${granularity === g.id
                    ? "bg-primary/15 text-primary border-primary"
                    : "bg-card text-muted border-border hover:text-text"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary cursor-pointer"
              checked={cumulative}
              onChange={e => setCumulative(e.target.checked)}
            />
            <span className="text-xs text-muted">Mostrar acumulado</span>
          </label>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[
            { label: "Intervalo", value: stats.range },
            { label: "Períodos", value: fmt.int(stats.periods) },
            { label: `Total (${metricCol})`, value: currency ? fmt.currencyCompact(stats.total) : fmt.compact(stats.total) },
            { label: "Média por período", value: currency ? fmt.currencyCompact(stats.avg) : fmt.compact(stats.avg) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card/60 border border-border rounded-xl px-4 py-3">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
              <p className="m-0 mt-1 text-base font-bold text-text truncate" title={String(value)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico */}
      <ChartCard
        title={`${metricCol} por ${GRANULARITIES.find(g => g.id === granularity)?.label.toLowerCase()}`}
        subtitle={cumulative ? "acumulado no tempo" : "total por período"}
        loading={loading}
      >
        {error
          ? <div className="text-danger text-sm text-center py-8">{error}</div>
          : <TemporalChart data={data} metricLabel={metricCol} cumulative={cumulative} currency={currency} />}
      </ChartCard>
    </div>
  )
}
