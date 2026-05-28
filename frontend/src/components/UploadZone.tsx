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
      const upload = await uploadFile(file)
      setSession({
        sessionId: upload.session_id,
        filename: upload.filename,
        rows: upload.rows,
        columns: upload.columns,
        colTypes: upload.col_types,
        isLoading: true,
      })

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
      setError(e?.response?.data?.detail || "Erro ao processar arquivo")
      setSession({ isLoading: false })
    } finally {
      setLoading(false)
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
        {loading ? "Processing your data..." : "Drop your file here"}
      </p>

      {/* Subtitle */}
      <p style={{
        fontSize: "14px",
        color: "#cbd5e1",
        margin: "0 0 16px 0",
        fontWeight: "400"
      }}>
        {loading ? "Uploading and analyzing..." : "or click to select from your computer"}
      </p>

      {/* Supported formats */}
      <div style={{
        display: "flex",
        gap: "8px",
        justifyContent: "center",
        flexWrap: "wrap",
        marginBottom: "8px"
      }}>
        {["Excel", "CSV", "JSON"].map(fmt => (
          <span
            key={fmt}
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
            {fmt}
          </span>
        ))}
      </div>

      {/* File size hint */}
      <p style={{
        fontSize: "12px",
        color: "#64748b",
        margin: 0
      }}>
        Max 100MB
      </p>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: "16px",
          padding: "10px 14px",
          backgroundColor: "rgba(248, 113, 113, 0.1)",
          border: "1px solid rgba(248, 113, 113, 0.3)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <p style={{ fontSize: "12px", color: "#fca5a5", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

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
  )
}
