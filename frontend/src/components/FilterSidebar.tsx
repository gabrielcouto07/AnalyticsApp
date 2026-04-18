import { useState } from "react"
import { useSession } from "../store/session"

export function FilterSidebar() {
  const activeFilters = useSession(s => s.activeFilters)
  const clearSession = useSession(s => s.clearSession)
  const [isOpen, setIsOpen] = useState(false)

  const getActiveFilterCount = () => {
    let count = 0
    if (activeFilters.date_range) count++
    if (activeFilters.categorical?.length > 0) count++
    if (activeFilters.numeric_range?.length > 0) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  const handleClear = () => {
    clearSession()
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: activeFilterCount > 0 ? "#3b82f6" : "#475569",
          color: "white",
          padding: "12px 16px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 45,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        <span>Filter</span>
        {activeFilterCount > 0 && (
          <span style={{ fontSize: "12px", fontWeight: "700" }}>
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 40 }} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: "380px", backgroundColor: "#0f172a", borderLeft: "1px solid #334155", zIndex: 50, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#f1f5f9" }}>Filtros</h2>
              <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}>X</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
              <p style={{ color: "#cbd5e1", margin: 0 }}>Sistema em desenvolvimento.</p>
            </div>
            {activeFilterCount > 0 && (
              <div style={{ padding: "16px 24px", borderTop: "1px solid #334155" }}>
                <button onClick={handleClear} style={{ width: "100%", padding: "10px 16px", backgroundColor: "rgba(248, 113, 113, 0.1)", color: "#f87171", border: "1px solid rgba(248, 113, 113, 0.2)", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Limpar</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
