import { useState } from "react"
import { useSession } from "../store/session"

// Data distribution analysis with histograms
export function DistributionPage() {
  const { colTypes } = useSession()
  const [selectedColumn, setSelectedColumn] = useState<string>(colTypes?.numeric?.[0] ?? "")

  const numericColumns = colTypes?.numeric ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Distribution Analysis</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Histograms, box plots, and statistical summaries</p>
      </div>

      {/* Column Selector */}
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
          Select Column
        </label>
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "300px",
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
          <option value="">Select a numeric column...</option>
          {numericColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {[
          { label: "Mean", value: "—" },
          { label: "Median", value: "—" },
          { label: "Std Dev", value: "—" },
          { label: "Min", value: "—" },
          { label: "Max", value: "—" },
          { label: "Q1", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Chart Placeholders */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        {[
          { title: "Histogram", icon: "📊" },
          { title: "Box Plot", icon: "📦" },
          { title: "Density Plot", icon: "📈" },
        ].map(({ title, icon }) => (
          <div key={title} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "240px" }}>
            <span style={{ fontSize: "32px", marginBottom: "8px" }}>{icon}</span>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f1f5f9", marginBottom: "4px" }}>{title}</p>
            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
              {selectedColumn ? `${selectedColumn}` : "Select column"}
            </p>
          </div>
        ))}
      </div>

      {/* Available Columns */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Available Numeric Columns</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {numericColumns.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>No numeric columns detected</p>
          ) : (
            numericColumns.map((col) => (
              <button
                key={col}
                onClick={() => setSelectedColumn(col)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: selectedColumn === col ? "#4f8ef7" : "#1e293b",
                  color: selectedColumn === col ? "#f1f5f9" : "#94a3b8",
                  border: `1px solid ${selectedColumn === col ? "#4f8ef7" : "#334155"}`,
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {col}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
