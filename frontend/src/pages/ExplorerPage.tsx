import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "../store/session"
import { exportUrl, getTable } from "../api/analytics"
import { fmt } from "../lib/format"

interface ColumnMeta {
  name: string
  dtype: string
}

interface TableData {
  rows: Record<string, unknown>[]
  total: number
  page: number
  page_size: number
  columns: ColumnMeta[]
  meaningful_columns: string[]
  datasets: string[]
}

const isNumericDtype = (dtype: string) => /int|float|number/i.test(dtype) && !/datetime/i.test(dtype)
const isDateDtype = (dtype: string) => /datetime/i.test(dtype)

function formatCell(value: unknown, dtype: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  if (typeof value === "number") return fmt.number(value)
  if (isDateDtype(dtype) && typeof value === "string") return fmt.date(value)
  return String(value)
}

const btnCls =
  "px-3 py-1.5 rounded-lg border border-border bg-card text-text text-xs font-semibold " +
  "hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"

// Explorador: a tabela completa (todas as colunas), paginada e ordenável
export function ExplorerPage() {
  const { sessionId } = useSession()
  const [data, setData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dataset, setDataset] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [visibleCols, setVisibleCols] = useState<string[] | null>(null) // null = essenciais
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const searchTimer = useRef<number | null>(null)

  const load = useCallback(() => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    getTable(sessionId, {
      dataset,
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_dir: sortDir,
      columns: visibleCols ?? undefined,
      search: search || undefined,
    })
      .then(setData)
      .catch(() => setError("Erro ao carregar os dados."))
      .finally(() => setLoading(false))
  }, [sessionId, dataset, page, pageSize, sortBy, sortDir, visibleCols, search])

  useEffect(load, [load])

  // busca com debounce para não martelar o backend a cada tecla
  const onSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 400)
  }

  const allColumns = data?.columns ?? []
  const meaningful = data?.meaningful_columns ?? []
  const shownColumns = useMemo(() => {
    if (!data) return []
    const wanted = visibleCols ?? (meaningful.length ? meaningful : allColumns.map(c => c.name))
    const byName = new Map(allColumns.map(c => [c.name, c]))
    return wanted.filter(n => byName.has(n)).map(n => byName.get(n)!)
  }, [data, visibleCols, meaningful, allColumns])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  const toggleSort = (col: string) => {
    setPage(1)
    if (sortBy === col) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
  }

  const toggleColumn = (name: string) => {
    const current = visibleCols ?? (meaningful.length ? meaningful : allColumns.map(c => c.name))
    const next = current.includes(name) ? current.filter(c => c !== name) : [...current, name]
    setVisibleCols(next)
  }

  const currentView = {
    dataset,
    columns: shownColumns.map(c => c.name),
    sort_by: sortBy,
    sort_dir: sortDir,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-text">Explorador de Dados</h2>
          <p className="mt-1 mb-0 text-sm text-muted">
            Tabela completa — {data ? `${fmt.int(data.total)} linhas` : "carregando…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={btnCls} href={sessionId ? exportUrl(sessionId, "csv", currentView) : "#"} download>
            ⬇ CSV (visão atual)
          </a>
          <a className={btnCls} href={sessionId ? exportUrl(sessionId, "excel", currentView) : "#"} download>
            ⬇ Excel (visão atual)
          </a>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        {(data?.datasets?.length ?? 0) > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="explorer-dataset" className="text-[11px] font-bold uppercase tracking-wide text-muted">Dataset / Aba</label>
            <select
              id="explorer-dataset"
              className="bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-primary/50"
              value={dataset ?? ""}
              onChange={e => { setDataset(e.target.value || undefined); setPage(1); setSortBy(undefined); setVisibleCols(null) }}
            >
              <option value="">Padrão (análise principal)</option>
              {data?.datasets.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-xs">
          <label htmlFor="explorer-search" className="text-[11px] font-bold uppercase tracking-wide text-muted">Buscar</label>
          <input
            id="explorer-search"
            type="search"
            placeholder="Filtrar em colunas de texto…"
            value={searchInput}
            onChange={e => onSearchChange(e.target.value)}
            className="bg-card text-text border border-border rounded-lg px-3 py-2 text-sm placeholder:text-faint hover:border-primary/50 focus:outline-none focus:border-primary"
          />
        </div>

        <button className={btnCls + " py-2"} onClick={() => setShowColumnPanel(v => !v)} aria-expanded={showColumnPanel}>
          Colunas ({shownColumns.length}/{allColumns.length}) {showColumnPanel ? "▴" : "▾"}
        </button>
      </div>

      {/* Painel de colunas */}
      {showColumnPanel && (
        <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <button className={btnCls} onClick={() => setVisibleCols(null)}>Essenciais ({meaningful.length})</button>
            <button className={btnCls} onClick={() => setVisibleCols(allColumns.map(c => c.name))}>Todas ({allColumns.length})</button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 max-h-48 overflow-y-auto">
            {allColumns.map(col => (
              <label key={col.name} className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer w-56 truncate">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={shownColumns.some(c => c.name === col.name)}
                  onChange={() => toggleColumn(col.name)}
                />
                <span className="truncate" title={col.name}>{col.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-card/60 border border-border rounded-xl overflow-hidden">
        {error && <div className="p-6 text-center text-danger text-sm">{error}</div>}
        <div className="overflow-x-auto" style={{ maxHeight: "60vh", overflowY: "auto", opacity: loading ? 0.5 : 1, transition: "opacity .15s" }}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface">
                {shownColumns.map(col => (
                  <th
                    key={col.name}
                    onClick={() => toggleSort(col.name)}
                    aria-sort={sortBy === col.name ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={`px-3 py-2.5 font-bold text-[11px] uppercase tracking-wide text-muted cursor-pointer select-none whitespace-nowrap border-b-2 border-border hover:text-text ${isNumericDtype(col.dtype) ? "text-right" : "text-left"}`}
                    title={`${col.name} (${col.dtype}) — clique para ordenar`}
                  >
                    {col.name}
                    <span className="ml-1 text-primary">{sortBy === col.name ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row, i) => (
                <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-surface/40" : ""} hover:bg-primary/5`}>
                  {shownColumns.map(col => (
                    <td
                      key={col.name}
                      className={`px-3 py-2 whitespace-nowrap max-w-[280px] truncate ${isNumericDtype(col.dtype) ? "text-right tabular-nums text-text" : "text-left text-muted"}`}
                      title={String(row[col.name] ?? "")}
                    >
                      {formatCell(row[col.name], col.dtype)}
                    </td>
                  ))}
                </tr>
              ))}
              {data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(shownColumns.length, 1)} className="p-8 text-center text-muted">
                    Nenhuma linha encontrada{search ? ` para "${search}"` : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <span className="text-[11px] text-muted">
            {data ? `Página ${data.page} de ${fmt.int(totalPages)} · ${fmt.int(data.total)} linhas` : ""}
          </span>
          <div className="flex items-center gap-2">
            <select
              aria-label="Linhas por página"
              className="bg-card text-text border border-border rounded-lg px-2 py-1 text-xs cursor-pointer"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / pág.</option>)}
            </select>
            <button className={btnCls} disabled={page <= 1} onClick={() => setPage(1)} aria-label="Primeira página">«</button>
            <button className={btnCls} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Página anterior">‹</button>
            <button className={btnCls} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Próxima página">›</button>
            <button className={btnCls} disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Última página">»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
