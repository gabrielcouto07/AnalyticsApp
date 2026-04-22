// Left sidebar: file info + new-upload button

import { useSession } from "../../store/session"

export function Sidebar() {
  const filename = useSession((state) => state.filename)
  const rowCount = useSession((state) => state.rowCount)
  const colCount = useSession((state) => state.colCount)
  const clearSession = useSession((state) => state.clearSession)

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#1e293b",
      color: "#f1f5f9"
    }}>
      <div style={{ padding: "16px", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>📊</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#f1f5f9", letterSpacing: "-0.3px" }}>
              Analytics
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "10px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Dashboard
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 12px",
          borderRadius: "10px",
          backgroundColor: "rgba(79, 142, 247, 0.15)",
          color: "#4f8ef7",
          fontSize: "13px",
          fontWeight: "700",
          borderLeft: "3px solid #4f8ef7",
        }}>
          <span style={{ fontSize: "18px" }}>🎯</span>
          <span>Dashboard</span>
        </div>
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid #334155", flexShrink: 0 }}>
        <p style={{ margin: "0 0 8px 0", fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Current File
        </p>
        <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: "600", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={filename ?? ""}>
          {filename || "No file"}
        </p>
        <p style={{ margin: "0 0 12px 0", fontSize: "11px", color: "#94a3b8", fontWeight: "500" }}>
          {rowCount?.toLocaleString("pt-BR") || 0} rows · {colCount || 0} columns
        </p>
        <button
          onClick={clearSession}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#f87171",
            backgroundColor: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ↩ New Upload
        </button>
      </div>
    </div>
  )
}
