import { useState } from "react"
import { useSession } from "../store/session"

// Free-form data exploration with scatter plots
export function ExplorerPage() {
  const { colTypes } = useSession()
  const [xColumn, setXColumn] = useState<string>(colTypes?.numeric?.[0] ?? "")
  const [yColumn, setYColumn] = useState<string>(colTypes?.numeric?.[1] ?? "")

  const numericColumns = colTypes?.numeric ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Data Explorer</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Scatter plots and variable relationships</p>
      </div>

      {/* Axis Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        {/* X Axis */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            X-Axis
          </label>
          <select
            value={xColumn}
            onChange={(e) => setXColumn(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <option value="">Select X-axis...</option>
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* Y Axis */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Y-Axis
          </label>
          <select
            value={yColumn}
            onChange={(e) => setYColumn(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <option value="">Select Y-axis...</option>
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {[
          { label: "Correlation", value: "—" },
          { label: "R² Value", value: "—" },
          { label: "Outliers", value: "—" },
          { label: "Trend", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Main Scatter Plot */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <span style={{ fontSize: "48px", marginBottom: "12px" }}>📍</span>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f1f5f9", marginBottom: "4px" }}>Scatter Plot</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
          {xColumn && yColumn ? `${xColumn} vs ${yColumn}` : "Select both X and Y axes"}
        </p>
      </div>

      {/* Additional Analysis */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {[
          { title: "Correlation Matrix", icon: "🔗", color: "#06b6d4" },
          { title: "Pair Plot", icon: "📊", color: "#4f8ef7" },
          { title: "Residual Plot", icon: "📈", color: "#a78bfa" },
        ].map(({ title, icon, color }) => (
          <div
            key={title}
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.6)",
              border: "1px solid #334155",
              borderRadius: "12px",
              borderLeft: `3px solid ${color}`,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>{icon}</span>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#f1f5f9" }}>{title}</p>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  )
}
