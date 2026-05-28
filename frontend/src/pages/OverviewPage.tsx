import { useEffect } from "react"
import { useSession } from "../store/session"
import { KpiCard } from "../components"
import { fmt } from "../lib/format"

// Overview dashboard with KPIs and health score
export function OverviewPage() {
  const { kpis, quality, colTypes, rows, columns, datasetType, sessionId } = useSession()

  useEffect(() => {
    console.log("[OverviewPage] kpis:", kpis)
    console.log("[OverviewPage] sessionId:", sessionId)
  }, [kpis, sessionId])

  const nullPct     = quality.length > 0 ? quality.reduce((a, b) => a + b.null_pct, 0) / quality.length : 0
  const health      = Math.max(0, Math.round(100 - nullPct))
  const healthColor = health >= 90 ? "#10b981" : health >= 70 ? "#f59e0b" : "#ef4444"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Overview</h2>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Dataset summary and key metrics</p>
        </div>
        {datasetType && (
          <span style={{ fontSize: "12px", backgroundColor: "rgba(79, 142, 247, 0.15)", color: "#4f8ef7", padding: "6px 12px", borderRadius: "999px", border: "1px solid rgba(79, 142, 247, 0.3)", fontWeight: "600" }}>
            {datasetType}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {kpis && kpis.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      ) : (
        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
          No numeric columns found for KPIs.
          <br />
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>
            sessionId: {sessionId ?? "undefined"}
          </span>
        </div>
      )}

      {/* Info Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        {/* Data Health */}
        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Data Health</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <span style={{ fontSize: "32px", fontWeight: "800", color: healthColor }}>{health}</span>
            <span style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "4px" }}>/ 100</span>
          </div>
          <div style={{ height: "6px", backgroundColor: "#334155", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ height: "6px", borderRadius: "999px", width: `${health}%`, backgroundColor: healthColor, transition: "all 0.7s ease" }} />
          </div>
          <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>{nullPct.toFixed(1)}% null on average</p>
        </div>

        {/* Summary */}
        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Summary</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              ["Rows", fmt.number(rows ?? 0)],
              ["Columns", String(columns ?? 0)],
              ["Dates", String(colTypes?.date?.length ?? 0)],
              ["Numeric", String(colTypes?.numeric?.length ?? 0)],
              ["Categorical", String(colTypes?.categorical?.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>{label}</span>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#f1f5f9" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nulls by Column */}
        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Null Columns</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "144px", overflowY: "auto" }}>
            {quality.filter(q => q.null_pct > 0).length === 0 && (
              <p style={{ margin: 0, fontSize: "11px", color: "#10b981" }}>✓ No nulls detected</p>
            )}
            {quality.filter(q => q.null_pct > 0).sort((a, b) => b.null_pct - a.null_pct).slice(0, 7).map(q => (
              <div key={q.column}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#94a3b8", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.column}>{q.column}</span>
                  <span style={{ fontSize: "10px", color: "#f59e0b" }}>{q.null_pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: "4px", backgroundColor: "#334155", borderRadius: "2px" }}>
                  <div style={{ height: "4px", backgroundColor: "#f59e0b", opacity: 0.6, borderRadius: "2px", width: `${Math.min(q.null_pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column Types */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {[
          { label: "Dates", cols: colTypes?.date ?? [], color: "#06b6d4" },
          { label: "Numeric", cols: colTypes?.numeric ?? [], color: "#4f8ef7" },
          { label: "Categorical", cols: colTypes?.categorical ?? [], color: "#a78bfa" },
        ].map(({ label, cols, color }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", borderLeft: `3px solid ${color}`, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
              <span style={{ fontSize: "11px", fontWeight: "700", color }}>{cols.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {cols.length === 0 && (
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>None detected</p>
              )}
              {cols.slice(0, 8).map(c => (
                <p key={c} style={{ margin: 0, fontSize: "11px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c}>• {c}</p>
              ))}
              {cols.length > 8 && (
                <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>+{cols.length - 8} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
