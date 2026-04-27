import { useCallback, useState } from "react"
import { uploadFile } from "../api/analytics"
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
        session_id: upload.session_id,
        filename: upload.filename,
        rows: upload.rows,
        columns: upload.columns,
        col_types: upload.col_types,
        template: upload.template ?? null,
      })
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Erro ao processar arquivo")
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
        border: `2px dashed ${dragging ? "#1f7a5a" : "rgba(11,79,58,0.3)"}`,
        backgroundColor: dragging ? "rgba(31, 122, 90, 0.12)" : "rgba(255, 255, 255, 0.85)",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: loading ? 0.7 : 1,
        pointerEvents: loading ? "none" : "auto",
        padding: "40px 20px",
        backdropFilter: "blur(6px)"
      }}
    >
      <input
        type="file"
        style={{ display: "none" }}
        accept=".xlsx,.xls,.xlsm,.csv,.txt,.json"
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
        color: "#0f172a",
        margin: "0 0 8px 0",
        letterSpacing: "-0.3px"
      }}>
        {loading ? "Processing your data..." : "Drop your file here"}
      </p>

      {/* Subtitle */}
      <p style={{
        fontSize: "14px",
        color: "#475569",
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
        {["XLSX", "XLSM", "CSV", "JSON"].map(fmt => (
          <span
            key={fmt}
            style={{
              fontSize: "11px",
              fontWeight: "600",
              padding: "4px 10px",
              backgroundColor: "rgba(31, 122, 90, 0.12)",
              color: "#0b4f3a",
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
        color: "#475569",
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
