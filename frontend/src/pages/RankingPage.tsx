import { useEffect, useMemo, useState } from "react"
import { useSession } from "../store/session"
import { getCrossChart } from "../api/analytics"
import { HBarChart, type NameValue } from "../components/charts/HBarChart"
import { ChartCard } from "../components/common"
import { fmt } from "../lib/format"

const AGGS = [
  { id: "sum", label: "Soma" },
  { id: "mean", label: "Média" },
  { id: "count", label: "Contagem" },
  { id: "max", label: "Máximo" },
] as const

const isPeriodCol = (c: string) => /^(ano|m[êe]s|year|month|dia|day)$/i.test(c)
const isCurrencyCol = (c: string) => /valor|total|receita|fatur|preço|preco|r\$/i.test(c)

const selectCls =
  "w-full bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer " +
  "hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"

// Ranking: top N de uma métrica por categoria
export function RankingPage() {
  const { sessionId, colTypes } = useSession()
  const categoricalColumns = colTypes?.categorical ?? []
  // monetárias primeiro — são a métrica padrão mais útil
  const numericColumns = (colTypes?.numeric ?? [])
    .filter(c => !isPeriodCol(c))
    .sort((a, b) => Number(isCurrencyCol(b)) - Number(isCurrencyCol(a)))

  const [catCol, setCatCol] = useState<string>(categoricalColumns[0] ?? "")
  const [numCol, setNumCol] = useState<string>(numericColumns[0] ?? "")
  const [aggFn, setAggFn] = useState<string>("sum")
  const [topN, setTopN] = useState(10)
  const [data, setData] = useState<NameValue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !catCol || !numCol) return
    setLoading(true)
    setError(null)
    getCrossChart(sessionId, { cat_col: catCol, num_col: numCol, agg_fn: aggFn, top_n: topN })
      .then(r => setData((r.data ?? []).map((d: any) => ({ name: String(d[catCol]), value: Number(d[aggFn] ?? 0) }))))
      .catch(e => setError(e?.response?.data?.detail || "Erro ao carregar o ranking."))
      .finally(() => setLoading(false))
  }, [sessionId, catCol, numCol, aggFn, topN])

  const currency = isCurrencyCol(numCol) && aggFn !== "count"
  const total = useMemo(() => data.reduce((a, b) => a + b.value, 0), [data])

  if (categoricalColumns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-xl font-bold text-text">Rankings</h2>
        <div className="bg-card/60 border border-border rounded-xl p-8 text-center text-muted text-sm">
          Nenhuma coluna categórica disponível.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Rankings</h2>
        <p className="mt-1 mb-0 text-sm text-muted">Top categorias por métrica agregada</p>
      </div>

      {/* Controles */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div>
          <label htmlFor="rank-cat" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Categoria</label>
          <select id="rank-cat" className={selectCls} value={catCol} onChange={e => setCatCol(e.target.value)}>
            {categoricalColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rank-num" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Métrica</label>
          <select id="rank-num" className={selectCls} value={numCol} onChange={e => setNumCol(e.target.value)}>
            {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rank-agg" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Agregação</label>
          <select id="rank-agg" className={selectCls} value={aggFn} onChange={e => setAggFn(e.target.value)}>
            {AGGS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rank-top" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Mostrar</label>
          <select id="rank-top" className={selectCls} value={topN} onChange={e => setTopN(Number(e.target.value))}>
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
      </div>

      {/* Gráfico + tabela */}
      <ChartCard
        title={`${AGGS.find(a => a.id === aggFn)?.label} de ${numCol} por ${catCol}`}
        subtitle={`top ${topN}`}
        loading={loading}
      >
        {error
          ? <div className="text-danger text-sm text-center py-8">{error}</div>
          : <HBarChart data={data} format={currency ? "currency" : "number"} height={Math.max(280, data.length * 34 + 60)} />}
      </ChartCard>

      {data.length > 0 && (
        <div className="bg-card/60 border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface border-b-2 border-border">
                  {["#", catCol, `${numCol} (${aggFn})`, "% do top"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.name} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-surface/40" : ""}`}>
                    <td className="px-4 py-2 text-muted font-bold">{i + 1}</td>
                    <td className="px-4 py-2 text-text max-w-[320px] truncate" title={d.name}>{d.name}</td>
                    <td className="px-4 py-2 text-text font-semibold tabular-nums">
                      {currency ? fmt.currency(d.value) : fmt.number(d.value)}
                    </td>
                    <td className="px-4 py-2 text-muted tabular-nums">
                      {total > 0 ? `${((d.value / total) * 100).toFixed(1).replace(".", ",")}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
