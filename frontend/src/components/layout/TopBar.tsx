// Top navigation bar that displays dashboard title, file info, and API status

import { useSession } from "../../store/session"

export function TopBar() {
  const { filename, rows } = useSession()

  return (
    <header style={{
      height: "64px",
      padding: "0 24px",
      borderBottom: "1px solid #334155",
      backgroundColor: "#0f172a",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backdropFilter: "blur(10px)",
      background: "linear-gradient(to bottom, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.4))"
    }}>
      {/* Left section */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        minWidth: 0,
        flex: 1
      }}>
        <h1 style={{
          fontSize: "18px",
          fontWeight: "700",
          color: "#f1f5f9",
          margin: 0,
          whiteSpace: "nowrap",
          letterSpacing: "-0.3px"
        }}>
          Dashboard
        </h1>
        
        {filename && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            backgroundColor: "rgba(30, 41, 59, 0.6)",
            border: "1px solid #334155",
            borderRadius: "8px",
            minWidth: 0
          }}>
            <span style={{
              fontSize: "11px",
              fontWeight: "600",
              color: "#cbd5e1",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              📄
            </span>
            <span style={{
              fontSize: "12px",
              color: "#e2e8f0",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: "500"
            }}>
              {filename}
            </span>
            {rows && (
              <>
                <span style={{ color: "#64748b" }}>•</span>
                <span style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  fontWeight: "500"
                }}>
                  {rows.toLocaleString("pt-BR")} rows
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right section */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginLeft: "auto"
      }}>
        {/* Status indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#10b981",
          fontWeight: "600",
          padding: "6px 12px",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(16, 185, 129, 0.2)"
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#10b981",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} />
          <span>API Active</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.5 }
        }
      `}</style>
    </header>
  )
}
