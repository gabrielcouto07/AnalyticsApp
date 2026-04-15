import { useSession } from "../store/session"

// Correlation matrix and heatmap analysis
export function CorrelationPage() {
  const { colTypes } = useSession()

  const numericColumns = colTypes?.numeric ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Correlation Analysis</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Correlation matrix and relationships between variables</p>
      </div>

      {/* Info Card */}
      <div style={{ backgroundColor: "rgba(79, 142, 247, 0.1)", border: "1px solid rgba(79, 142, 247, 0.3)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px" }}>
        <span style={{ fontSize: "16px", marginTop: "2px" }}>ℹ️</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#f1f5f9" }}>Numeric Columns Detected</p>
          <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>
            {numericColumns.length === 0
              ? "No numeric columns found. Correlation requires numeric data."
              : `${numericColumns.length} numeric column${numericColumns.length > 1 ? "s" : ""} available for correlation analysis.`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        {[
          { label: "Matrix Size", value: `${numericColumns.length}×${numericColumns.length}` },
          { label: "Strong Correlations", value: "—" },
          { label: "Weak Correlations", value: "—" },
          { label: "No Correlation", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Correlation Heatmap Placeholder */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "320px" }}>
        <span style={{ fontSize: "40px", marginBottom: "12px" }}>🔗</span>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f1f5f9", marginBottom: "4px" }}>Correlation Heatmap</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
          {numericColumns.length > 0 ? "Heatmap visualization coming soon" : "No numeric columns available"}
        </p>
      </div>

      {/* Numeric Columns List */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Numeric Columns Included</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {numericColumns.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>No numeric columns found</p>
          ) : (
            numericColumns.map((col) => (
              <span
                key={col}
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  backgroundColor: "rgba(79, 142, 247, 0.1)",
                  color: "#4f8ef7",
                  border: "1px solid rgba(79, 142, 247, 0.3)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "500",
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={col}
              >
                {col}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Top Correlations */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Top Correlations</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { pair: "Column A × Column B", corr: "—", strength: "—" },
            { pair: "Column C × Column D", corr: "—", strength: "—" },
            { pair: "Column E × Column F", corr: "—", strength: "—" },
          ].map(({ pair, corr, strength }) => (
            <div key={pair} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
              <span style={{ fontSize: "11px", color: "#f1f5f9" }}>{pair}</span>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#f1f5f9", minWidth: "40px", textAlign: "right" }}>{corr}</span>
                <span style={{ fontSize: "10px", color: "#94a3b8", minWidth: "60px", textAlign: "right" }}>{strength}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
