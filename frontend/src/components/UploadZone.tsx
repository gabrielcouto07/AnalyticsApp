import { useCallback, useState, type DragEvent } from "react"

import { uploadFile } from "../api/analytics"
import { useSessionStore } from "../store/session"

const ALLOWED_EXTENSIONS = ["xlsx", "xls", "xlsm", "csv", "txt", "json"]
const MAX_FILE_SIZE = 100 * 1024 * 1024

function validateFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return `Formato invalido. Use: ${ALLOWED_EXTENSIONS.join(", ")}`
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Arquivo excede o limite de 100MB"
  }
  return null
}

export function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileHint, setFileHint] = useState<string | null>(null)
  const setSession = useSessionStore((state) => state.setSession)
  const closeUpload = useSessionStore((state) => state.closeUpload)

  const handle = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setFileHint(`${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`)
    setUploadProgress(0)
    setLoading(true)
    setError(null)

    try {
      const upload = await uploadFile(file, setUploadProgress)
      setSession({
        session_id: upload.session_id,
        filename: upload.filename,
        rows: upload.rows,
        columns: upload.columns,
        schema_types: upload.schema_types,
      })
      closeUpload()
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.detail || "Erro ao processar arquivo")
    } finally {
      setUploadProgress(100)
      setLoading(false)
    }
  }, [closeUpload, setSession])

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) {
      void handle(file)
    }
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
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
        backdropFilter: "blur(6px)",
      }}
    >
      <input
        type="file"
        style={{ display: "none" }}
        accept=".xlsx,.xls,.xlsm,.csv,.json,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handle(file)
          }
        }}
      />

      <div
        style={{
          fontSize: "56px",
          marginBottom: "16px",
          animation: loading ? "spin 1.5s linear infinite" : "float 3s ease-in-out infinite",
          display: "inline-block",
        }}
      >
        {loading ? "⚙️" : "📤"}
      </div>

      <p
        style={{
          fontSize: "18px",
          fontWeight: "700",
          color: "#0f172a",
          margin: "0 0 8px 0",
          letterSpacing: "-0.3px",
        }}
      >
        {loading ? "Processing your data..." : "Drop your file here"}
      </p>

      <p
        style={{
          fontSize: "14px",
          color: "#475569",
          margin: "0 0 16px 0",
          fontWeight: "400",
        }}
      >
        {loading ? "Uploading and analyzing..." : "or click to select from your computer"}
      </p>

      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        {["XLSX", "CSV", "JSON", "TXT"].map((format) => (
          <span
            key={format}
            style={{
              fontSize: "11px",
              fontWeight: "600",
              padding: "4px 10px",
              backgroundColor: "rgba(31, 122, 90, 0.12)",
              color: "#0b4f3a",
              borderRadius: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {format}
          </span>
        ))}
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "#475569",
          margin: 0,
        }}
      >
        Max 100MB
      </p>

      {fileHint && (
        <p style={{ fontSize: "12px", color: "#0b4f3a", marginTop: "6px", fontWeight: 600 }}>
          {fileHint}
        </p>
      )}

      {loading && (
        <div style={{ width: "100%", maxWidth: 320, marginTop: 14 }}>
          <div style={{ height: 8, width: "100%", background: "rgba(15,23,42,0.15)", borderRadius: 999 }}>
            <div
              style={{
                height: "100%",
                width: `${uploadProgress}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, #1f7a5a, #06b6d4)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: "#0f172a", textAlign: "center", fontWeight: 700 }}>
            Upload: {uploadProgress}%
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 14px",
            backgroundColor: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
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
