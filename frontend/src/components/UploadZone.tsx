import { useCallback, useState } from "react"
import { uploadFile, getKpis, getQuality, getStats, getDashboard } from "../api/analytics"
import { useSession } from "../store/session"

interface Props {
  /** Chamado após uma nova sessão ser ativada com sucesso. */
  onSuccess?: () => void
  /** Cancelar o re-upload e voltar à sessão anterior (só quando ela existe). */
  onCancel?: () => void
}

export function UploadZone({ onSuccess, onCancel }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const beginUpload = useSession(s => s.beginUpload)
  const activateSession = useSession(s => s.activateSession)
  const failUpload = useSession(s => s.failUpload)
  const uploadError = useSession(s => s.uploadError)
  const uploadErrorDetail = useSession(s => s.uploadErrorDetail)

  const handle = useCallback(async (file: File) => {
    setLoading(true)
    beginUpload() // NÃO toca na sessão ativa atual — só marca "processing"
    try {
      // 1) Upload + parse no backend (pode dar timeout ou erro de planilha)
      const upload = await uploadFile(file)

      // 2) Busca os derivados ANTES de ativar — se algo falhar aqui, a sessão
      //    anterior continua intacta (ativação é transacional).
      const [kpisData, qualityData, statsData] = await Promise.all([
        getKpis(upload.session_id),
        getQuality(upload.session_id),
        getStats(upload.session_id),
      ])

      // 3) Modelo fiscal: valida o endpoint de dashboard antes de ativar
      if ((upload.model ?? "generic") === "medical_fiscal") {
        await getDashboard(upload.session_id, {})
      }

      // 4) Tudo ok → ativa a nova sessão atomicamente (substitui a anterior)
      activateSession({
        sessionId: upload.session_id,
        filename: upload.filename,
        rows: upload.rows,
        columns: upload.columns,
        colTypes: upload.col_types,
        model: upload.model ?? "generic",
        sheets: upload.sheets ?? [],
        meaningfulColumns: upload.meaningful_columns ?? [],
        datasets: upload.datasets ?? [],
        source: upload.source ?? null,
        kpis: kpisData.kpis || [],
        quality: qualityData.quality || [],
        stats: statsData.stats || {},
        datasetType: kpisData.dataset_type || null,
      })
      onSuccess?.()
    } catch (e: any) {
      const isTimeout = e?.code === "ECONNABORTED" || /timeout/i.test(e?.message ?? "")
      const backendDetail = e?.response?.data
      const backendMsg = typeof backendDetail?.detail === "string" ? backendDetail.detail : null
      const stage: string | null = backendDetail?.stage ?? (isTimeout ? "upload" : null)

      const message = isTimeout
        ? "O processamento excedeu o tempo limite. O arquivo pode ser muito grande ou complexo. Nenhum dado anterior foi perdido."
        : backendMsg
          ?? "Não foi possível processar esta planilha. Nenhum dado anterior foi perdido. Consulte os detalhes e tente novamente."

      failUpload(message, {
        stage,
        code: e?.response?.status ? String(e.response.status) : (e?.code ?? null),
        filename: file.name,
      })
    } finally {
      setLoading(false)
    }
  }, [beginUpload, activateSession, failUpload, onSuccess])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }

  return (
    <div style={{ width: "100%" }}>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minHeight: "240px",
          borderRadius: "16px",
          border: `2px dashed ${dragging ? "#4f8ef7" : "#334155"}`,
          backgroundColor: dragging ? "rgba(79, 142, 247, 0.1)" : "rgba(30, 41, 59, 0.4)",
          cursor: "pointer",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: loading ? 0.7 : 1,
          pointerEvents: loading ? "none" : "auto",
          padding: "40px 20px",
          backdropFilter: "blur(10px)"
        }}
      >
        <input
          type="file"
          style={{ display: "none" }}
          accept=".xlsx,.xls,.csv,.txt,.json"
          onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
        />

        {/* Icon with pulsing effect */}
        <div style={{
          fontSize: "56px",
          marginBottom: "16px",
          animation: loading ? "spin 1.5s linear infinite" : "float 3s ease-in-out infinite",
          display: "inline-block"
        }}>
          {loading ? "⚙️" : "📤"}
        </div>

        {/* Main text */}
        <p style={{
          fontSize: "18px",
          fontWeight: "700",
          color: "#f1f5f9",
          margin: "0 0 8px 0",
          letterSpacing: "-0.3px"
        }}>
          {loading ? "Processando sua planilha..." : "Solte seu arquivo aqui"}
        </p>

        {/* Subtitle */}
        <p style={{
          fontSize: "14px",
          color: "#cbd5e1",
          margin: "0 0 16px 0",
          fontWeight: "400"
        }}>
          {loading ? "Enviando e analisando..." : "ou clique para selecionar do seu computador"}
        </p>

        {/* Supported formats */}
        <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "8px"
        }}>
          {["Excel", "CSV", "JSON"].map(f => (
            <span
              key={f}
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "4px 10px",
                backgroundColor: "rgba(79, 142, 247, 0.15)",
                color: "#94a3b8",
                borderRadius: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* File size hint */}
        <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
          Máx 100MB
        </p>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) }
            50% { transform: translateY(-12px) }
          }
          @keyframes spin {
            from { transform: rotate(0deg) }
            to { transform: rotate(360deg) }
          }
        `}</style>
      </label>

      {/* Erro de upload em pt-BR — a sessão anterior (se houver) foi preservada */}
      {uploadError && !loading && (
        <div
          role="alert"
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            backgroundColor: "rgba(248, 113, 113, 0.08)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: "12px",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", color: "#fca5a5", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                {uploadError}
              </p>
              {uploadErrorDetail && (
                <details style={{ marginTop: "10px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                    Detalhes técnicos
                  </summary>
                  <ul style={{ margin: "8px 0 0", paddingLeft: "16px", fontSize: "11px", color: "#94a3b8" }}>
                    {uploadErrorDetail.stage && <li>Etapa: {uploadErrorDetail.stage}</li>}
                    {uploadErrorDetail.code && <li>Código: {uploadErrorDetail.code}</li>}
                    {uploadErrorDetail.filename && <li>Arquivo: {uploadErrorDetail.filename}</li>}
                    <li>Momento: {uploadErrorDetail.timestamp}</li>
                  </ul>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancelar re-upload (só quando existe uma sessão válida para voltar) */}
      {onCancel && !loading && (
        <button
          onClick={onCancel}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#cbd5e1",
            backgroundColor: "transparent",
            border: "1px solid #334155",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Cancelar e voltar ao painel atual
        </button>
      )}
    </div>
  )
}
