import { useEffect, useMemo, useState } from "react"
import { useSession } from "../store/session"
import { getCorrelation } from "../api/analytics"
import { CorrelationChart } from "../components/CorrelationChart"
import { ChartCard } from "../components/common"

// Correlação: heatmap de Pearson + pares mais correlacionados
export function CorrelationPage() {
  const { sessionId } = useSession()
  const [columns, setColumns] = useState<string[]>([])
  const [matrix, setMatrix] = useState<(number | null)[][]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    getCorrelation(sessionId)
      .then(r => { setColumns(r.columns ?? []); setMatrix(r.data ?? []) })
      .catch(() => setError("Erro ao carregar a matriz de correlação."))
      .finally(() => setLoading(false))
  }, [sessionId])

  const topPairs = useMemo(() => {
    const pairs: { a: string; b: string; r: number }[] = []
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const r = matrix[i]?.[j]
        if (typeof r === "number" && Number.isFinite(r)) pairs.push({ a: columns[i], b: columns[j], r })
      }
    }
    return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 6)
  }, [columns, matrix])

  const strength = (r: number) =>
    Math.abs(r) >= 0.7 ? "forte" : Math.abs(r) >= 0.4 ? "moderada" : "fraca"

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Correlação</h2>
        <p className="mt-1 mb-0 text-sm text-muted">
          Relação linear (Pearson) entre as colunas numéricas — {columns.length} colunas
        </p>
      </div>

      <ChartCard title="Matriz de correlação" subtitle="azul = negativa · laranja = positiva" loading={loading}>
        {error
          ? <div className="text-danger text-sm text-center py-8">{error}</div>
          : <CorrelationChart columns={columns} matrix={matrix} />}
      </ChartCard>

      {topPairs.length > 0 && (
        <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col gap-2">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">Pares mais correlacionados</p>
          {topPairs.map(({ a, b, r }) => (
            <div key={`${a}|${b}`} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-b-0">
              <span className="text-xs text-text truncate" title={`${a} × ${b}`}>{a} × {b}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold tabular-nums text-text">{r.toFixed(3).replace(".", ",")}</span>
                <span className="text-[10px] text-muted w-16 text-right">{strength(r)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
