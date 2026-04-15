import { useMemo } from "react"
import { useSession } from "../store/session"

// Data quality metrics and null analysis
export function QualityPage() {
  const { quality, colTypes, rows } = useSession()

  const stats = useMemo(() => {
    if (!quality.length) return { totalNulls: 0, nullColumns: 0, avgNullPct: 0 }
    const totalNulls = quality.reduce((a, b) => a + (b.null_count || 0), 0)
    const nullColumns = quality.filter((q) => q.null_pct > 0).length
    const avgNullPct = quality.reduce((a, b) => a + b.null_pct, 0) / quality.length
    return { totalNulls, nullColumns, avgNullPct }
  }, [quality])

  const sortedQuality = useMemo(
    () => [...quality].sort((a, b) => b.null_pct - a.null_pct),
    [quality]
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Data Quality</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Column-level quality metrics and null analysis</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {[
          { label: "Total Nulls", value: stats.totalNulls.toLocaleString(), color: "#f59e0b" },
          { label: "Columns with Nulls", value: stats.nullColumns, color: "#ef4444" },
          { label: "Average Null %", value: `${stats.avgNullPct.toFixed(1)}%`, color: "#3b82f6" },
          { label: "Complete Records", value: "—", color: "#10b981" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: `3px solid ${color}` }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quality Table */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155", backgroundColor: "rgba(15, 23, 42, 0.5)" }}>
                {["Column", "Type", "Nulls", "Null %", "Unique", "Sample"].map((header) => (
                  <th key={header} style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedQuality.map((item, i) => (
                <tr key={item.column} style={{ borderBottom: "1px solid #1e293b", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(15, 23, 42, 0.3)" }}>
                  <td style={{ padding: "12px 16px", color: "#f1f5f9", fontWeight: "500", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.column}>
                    {item.column}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>
                    <span style={{ display: "inline-block", fontSize: "11px", backgroundColor: "rgba(79, 142, 247, 0.1)", color: "#4f8ef7", padding: "2px 8px", borderRadius: "4px" }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: item.null_count > 0 ? "#f59e0b" : "#10b981", fontWeight: "600" }}>
                    {item.null_count || 0}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ height: "4px", width: "40px", backgroundColor: "#334155", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{
                          height: "4px",
                          backgroundColor: item.null_pct > 50 ? "#ef4444" : item.null_pct > 20 ? "#f59e0b" : "#10b981",
                          width: `${Math.min(item.null_pct, 100)}%`,
                        }} />
                      </div>
                      <span style={{ color: item.null_pct > 0 ? "#f59e0b" : "#10b981", fontWeight: "600", minWidth: "40px" }}>
                        {item.null_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>
                    {item.unique || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1", fontSize: "12px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.sample || ""}>
                    {item.sample || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedQuality.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#94a3b8" }}>
            <p style={{ margin: 0, fontSize: "14px" }}>No data available</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
        {[
          { color: "#10b981", label: "Good (0-5%)" },
          { color: "#f59e0b", label: "Moderate (5-20%)" },
          { color: "#ef4444", label: "Poor (>20%)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: color }} />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
