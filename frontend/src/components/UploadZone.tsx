import { useCallback, useState } from "react"
import { uploadFile, getKpis, getQuality, getStats } from "../api/analytics"
import { useSession } from "../store/session"

export function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSession = useSession(s => s.setSession)

  const handle = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Upload do arquivo
      const upload = await uploadFile(file)
      setSession({
        sessionId: upload.session_id,
        filename: upload.filename,
        rows: upload.rows,
        columns: upload.columns,
        colTypes: upload.col_types,
        isLoading: true,
      })

      // 2. Busca tudo em paralelo — Promise.all garante que só renderiza quando tudo chegou
      const [kpisData, qualityData, statsData] = await Promise.all([
        getKpis(upload.session_id),
        getQuality(upload.session_id),
        getStats(upload.session_id),
      ])

      setSession({
        kpis: kpisData.kpis || [],
        quality: qualityData.quality || [],
        stats: statsData.stats || {},
        datasetType: kpisData.dataset_type || null,
        isLoading: false,
      })
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Erro ao processar arquivo")
      setSession({ isLoading: false })
    }
  }, [setSession])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center w-full h-64 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all duration-300
        ${dragging ? "border-primary bg-primary/10 scale-105" : "border-border hover:border-primary/60 hover:bg-primary/5"}
        ${loading ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv,.txt,.json"
        onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
      />
      <div className={`text-6xl mb-4 transition-all duration-300 ${loading ? 'animate-spin' : 'animate-bounce'}`}>
        {loading ? '⚙️' : '📂'}
      </div>
      <p className="text-text font-bold text-lg text-center">
        {loading ? 'Processando seu arquivo...' : 'Arraste ou clique para carregar'}
      </p>
      <p className="text-muted text-sm mt-2 text-center">
        {loading ? 'Por favor, aguarde' : 'Excel, CSV, TXT ou JSON • Até 100MB'}
      </p>
      {error && <p className="text-danger text-sm mt-4 font-medium text-center max-w-xs">{error}</p>}
    </label>
  )
}
