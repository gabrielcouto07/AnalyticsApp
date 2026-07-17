import { useState } from "react"
import { useSession } from "../store/session"
import { exportUrl } from "../api/analytics"
import { fmt } from "../lib/format"

// Exportação: baixa o dataset (ou uma aba específica) em Excel/CSV
export function ExportPage() {
  const { sessionId, filename, rows, columns, datasets } = useSession()
  const [dataset, setDataset] = useState<string>("")
  const [downloading, setDownloading] = useState<"excel" | "csv" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: "excel" | "csv") => {
    if (!sessionId) return
    setDownloading(format)
    setError(null)
    try {
      const response = await fetch(exportUrl(sessionId, format, { dataset: dataset || undefined }))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      const base = (filename?.replace(/\.[^/.]+$/, "") || "export") + (dataset ? `_${dataset}` : "")
      link.href = url
      link.download = `${base}.${format === "excel" ? "xlsx" : "csv"}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch {
      setError("Falha na exportação. Verifique se o backend está ativo e tente novamente.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="m-0 text-xl font-bold text-text">Exportar Dados</h2>
        <p className="mt-1 mb-0 text-sm text-muted">Baixe os dados tratados e tipados em Excel ou CSV</p>
      </div>

      {/* Arquivo + escolha de dataset */}
      <div className="bg-card/60 border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>📄</span>
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-text truncate">{filename || "dataset"}</p>
            <p className="m-0 mt-0.5 text-[11px] text-muted">
              {fmt.int(rows)} linhas × {columns} colunas (análise principal)
            </p>
          </div>
        </div>

        {datasets.length > 1 && (
          <div>
            <label htmlFor="export-dataset" className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">
              O que exportar
            </label>
            <select
              id="export-dataset"
              className="w-full max-w-sm bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-primary/50"
              value={dataset}
              onChange={e => setDataset(e.target.value)}
            >
              <option value="">Análise principal (dados tratados)</option>
              {datasets.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
          {([
            { name: "Excel (.xlsx)", format: "excel" as const, color: "#34c97e" },
            { name: "CSV", format: "csv" as const, color: "#4f8ef7" },
          ]).map(({ name, format, color }) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={downloading !== null}
              aria-busy={downloading === format}
              className="px-4 py-3 rounded-lg font-semibold text-sm text-text bg-card border-2 transition-all cursor-pointer
                         disabled:cursor-not-allowed disabled:opacity-50 hover:bg-surface"
              style={{ borderColor: color }}
            >
              {downloading === format ? "Exportando…" : `⬇ ${name}`}
            </button>
          ))}
        </div>

        {error && (
          <p className="m-0 text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Nota */}
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex gap-3">
        <span aria-hidden>ℹ️</span>
        <p className="m-0 text-xs text-muted leading-relaxed">
          A exportação usa os dados <strong className="text-text">tipados e tratados</strong> pelo parser
          (CNPJ/CPF como texto, datas reais, valores numéricos) — não os textos de exibição.
          Para exportar uma visão filtrada/ordenada da tabela, use os botões de exportação no Explorador.
        </p>
      </div>
    </div>
  )
}
