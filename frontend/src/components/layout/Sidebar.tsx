// Left sidebar navigation with page links and current file info

import { useSession } from "../../store/session"

const NAV = [
  { id: "overview", icon: "📊", label: "Overview" },
  { id: "temporal", icon: "📈", label: "Temporal" },
  { id: "distribution", icon: "📉", label: "Distribution" },
  { id: "ranking", icon: "🏅", label: "Ranking" },
  { id: "explorer", icon: "🔍", label: "Explorer" },
  { id: "correlation", icon: "🔗", label: "Correlation" },
  { id: "quality", icon: "✅", label: "Quality" },
  { id: "export", icon: "📥", label: "Export" },
] as const

export type PageId = typeof NAV[number]["id"]

interface SidebarProps {
  active: PageId
  onChange: (page: PageId) => void
}

export function Sidebar({ active, onChange }: SidebarProps) {
  const { filename, rows, columns, clear } = useSession()

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#1e293b",
      color: "#f1f5f9"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid #334155",
        flexShrink: 0
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "24px" }}>📊</span>
          <div>
            <p style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: "700",
              color: "#f1f5f9",
              letterSpacing: "-0.3px"
            }}>
              Analytics
            </p>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "10px",
              fontWeight: "600",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: "8px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}>
        {NAV.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onChange(id as PageId)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 12px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: active === id ? "rgba(79, 142, 247, 0.15)" : "transparent",
              color: active === id ? "#4f8ef7" : "#cbd5e1",
              fontSize: "13px",
              fontWeight: active === id ? "700" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              textAlign: "left",
              borderLeft: active === id ? "3px solid #4f8ef7" : "3px solid transparent"
            }}
            onMouseEnter={e => {
              if (active !== id) {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
                e.currentTarget.style.color = "#e2e8f0"
              }
            }}
            onMouseLeave={e => {
              if (active !== id) {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "#cbd5e1"
              }
            }}
          >
            <span style={{ fontSize: "18px", flexShrink: 0 }}>{icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* File Info Footer */}
      <div style={{
        padding: "16px",
        borderTop: "1px solid #334155",
        flexShrink: 0
      }}>
        <p style={{
          margin: "0 0 8px 0",
          fontSize: "10px",
          fontWeight: "700",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          Current File
        </p>
        
        <p style={{
          margin: "0 0 4px 0",
          fontSize: "12px",
          fontWeight: "600",
          color: "#e2e8f0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }} title={filename ?? ""}>
          {filename || "No file"}
        </p>
        
        <p style={{
          margin: "0 0 12px 0",
          fontSize: "11px",
          color: "#94a3b8",
          fontWeight: "500"
        }}>
          {rows?.toLocaleString("pt-BR") || 0} rows · {columns || 0} columns
        </p>
        
        <button
          onClick={clear}
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
            transition: "all 0.2s ease"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.2)"
            e.currentTarget.style.borderColor = "rgba(248, 113, 113, 0.4)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.1)"
            e.currentTarget.style.borderColor = "rgba(248, 113, 113, 0.2)"
          }}
        >
          ↩ New Upload
        </button>
      </div>
    </div>
  )
}
