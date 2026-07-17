import { useMemo, useState } from "react"
import { useSession } from "../store/session"
import { fmt } from "../lib/format"

type SortKey = "column" | "null_pct" | "unique"

// Qualidade: métricas por coluna (nulos, únicos, tipo, amostra)
export function QualityPage() {
  const { quality } = useSession()
  const [sortKey, setSortKey] = useState<SortKey>("null_pct")
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    if (!quality.length) return { totalNulls: 0, nullColumns: 0, avgNullPct: 0, cleanColumns: 0 }
    const totalNulls = quality.reduce((a, b) => a + (b.nulls || 0), 0)
    const nullColumns = quality.filter(q => q.null_pct > 0).length
    const avgNullPct = quality.reduce((a, b) => a + b.null_pct, 0) / quality.length
    return { totalNulls, nullColumns, avgNullPct, cleanColumns: quality.length - nullColumns }
  }, [quality])

  const sorted = useMemo(() => {
    const arr = [...quality].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      const cmp = typeof va === "string" ? String(va).localeCompare(String(vb)) : Number(va) - Number(vb)
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [quality, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(key === "column") }
  }

  const headers: { key: SortKey | null; label: string }[] = [
    { key: "column", label: "Coluna" },
    { key: null, label: "Tipo" },
    { key: "null_pct", label: "Nulos" },
    { key: "unique", label: "Únicos" },
    { key: null, label: "Amostra" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Qualidade dos Dados</h2>
        <p className="mt-1 mb-0 text-sm text-muted">Métricas de completude e integridade por coluna</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {[
          { label: "Total de nulos", value: fmt.int(stats.totalNulls), color: "#f59e0b" },
          { label: "Colunas com nulos", value: String(stats.nullColumns), color: "#f87171" },
          { label: "Nulos (média)", value: `${stats.avgNullPct.toFixed(1).replace(".", ",")}%`, color: "#4f8ef7" },
          { label: "Colunas completas", value: String(stats.cleanColumns), color: "#34c97e" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card/60 border border-border rounded-xl p-4 flex flex-col gap-2" style={{ borderLeft: `3px solid ${color}` }}>
            <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
            <p className="m-0 text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-card/60 border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: "58vh", overflowY: "auto" }}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface">
                {headers.map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    aria-sort={key === sortKey ? (sortAsc ? "ascending" : "descending") : "none"}
                    className={`px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted border-b-2 border-border whitespace-nowrap ${key ? "cursor-pointer select-none hover:text-text" : ""}`}
                  >
                    {label}{key === sortKey ? (sortAsc ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => (
                <tr key={item.column} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-surface/40" : ""}`}>
                  <td className="px-4 py-2 text-text font-medium max-w-[220px] truncate" title={item.column}>{item.column}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded">{item.type}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-10 bg-border rounded-sm overflow-hidden shrink-0">
                        <div
                          className="h-1 rounded-sm"
                          style={{
                            width: `${Math.min(item.null_pct, 100)}%`,
                            backgroundColor: item.null_pct > 50 ? "#f87171" : item.null_pct > 20 ? "#f59e0b" : "#34c97e",
                          }}
                        />
                      </div>
                      <span className={`font-semibold tabular-nums ${item.null_pct > 0 ? "text-warning" : "text-success"}`}>
                        {item.null_pct.toFixed(1).replace(".", ",")}%
                      </span>
                      <span className="text-faint text-[11px] tabular-nums">({fmt.int(item.nulls)})</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted tabular-nums">{fmt.int(item.unique)}</td>
                  <td className="px-4 py-2 text-muted text-xs max-w-[200px] truncate" title={item.sample || ""}>{item.sample || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-muted text-sm">Sem dados disponíveis</div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-wrap gap-6">
        {[
          { color: "#34c97e", label: "Boa (0–20% nulos)" },
          { color: "#f59e0b", label: "Moderada (20–50%)" },
          { color: "#f87171", label: "Crítica (>50%)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
