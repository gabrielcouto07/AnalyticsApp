// Top navigation bar that displays dashboard title, file info, and API status

import { useSession } from "../../store/session"
import { useEffect, useState } from "react"
// import { getFilterStatus } from "../../api/analytics" // TODO: Implement filter status endpoint

export function TopBar() {
  const sessionId = useSession(s => s.sessionId)
  const filename = useSession(s => s.filename)
  const rowCount = useSession(s => s.rowCount)
  const activeFilters = useSession(s => s.activeFilters)

  const [filterStatus, setFilterStatus] = useState<any>(null)
  const [lastFilterCount, setLastFilterCount] = useState(0)

  useEffect(() => {
    const filterCount = (activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) + (activeFilters.date_range ? 1 : 0)
    if (sessionId && filterCount > 0 && filterCount !== lastFilterCount) {
      setLastFilterCount(filterCount)
      // TODO: Implement getFilterStatus
      // getFilterStatus(sessionId).then(setFilterStatus).catch(console.error)
    }
    if (filterCount === 0) {
      setFilterStatus(null)
      setLastFilterCount(0)
    }
  }, [sessionId, activeFilters])

  const filteredRows = filterStatus?.filtered_rows ?? rowCount

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
            {rowCount && (
              <>
                <span style={{ color: "#64748b" }}>•</span>
                <span style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  fontWeight: "500"
                }}>
                  {filteredRows !== rowCount && (activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) > 0 ? (
                    <>
                      Mostrando {filteredRows.toLocaleString("pt-BR")} de {rowCount.toLocaleString("pt-BR")} rows
                    </>
                  ) : (
                    <>
                      {rowCount.toLocaleString("pt-BR")} rows
                    </>
                  )}
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
        {/* Filter badge */}
        {((activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) + (activeFilters.date_range ? 1 : 0)) > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#3b82f6",
            fontWeight: "600",
            padding: "6px 12px",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: "8px",
            border: "1px solid rgba(59, 130, 246, 0.2)"
          }}>
            {(() => {
              const count = (activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) + (activeFilters.date_range ? 1 : 0)
              return <span>🔍 {count} filtro{count > 1 ? 's' : ''}</span>
            })()}
          </div>
        )}

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
