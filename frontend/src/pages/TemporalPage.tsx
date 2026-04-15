import { useState } from "react"
import { useSession } from "../store/session"

// Temporal analysis with time series data and trends
export function TemporalPage() {
  const { quality, colTypes } = useSession()
  const [selectedDate, setSelectedDate] = useState<string>(colTypes?.date?.[0] ?? "")
  const [granularity, setGranularity] = useState<"day" | "month" | "year">("day")

  const dateColumns = colTypes?.date ?? []
  const numericColumns = colTypes?.numeric ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Temporal Analysis</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Time series trends and patterns</p>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        {/* Date Column Selector */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Date Column
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
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
            <option value="">Select date column...</option>
            {dateColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* Granularity Selector */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Granularity
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["day", "month", "year"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  backgroundColor: granularity === g ? "#4f8ef7" : "#1e293b",
                  color: granularity === g ? "#f1f5f9" : "#94a3b8",
                  border: `1px solid ${granularity === g ? "#4f8ef7" : "#334155"}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        {[
          { label: "Time Range", value: "—" },
          { label: "Total Records", value: "—" },
          { label: "Avg per Period", value: "—" },
          { label: "Data Gaps", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#f1f5f9" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder for Charts */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "40px", textAlign: "center", minHeight: "300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>📅 Time series charts coming soon</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
          {selectedDate ? `Selected column: ${selectedDate}` : "Select a date column to get started"}
        </p>
      </div>

      {/* Data Columns Info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Available Dates</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {dateColumns.length === 0 ? (
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>None detected</p>
            ) : (
              dateColumns.slice(0, 5).map((col) => (
                <p key={col} style={{ margin: 0, fontSize: "11px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={col}>
                  • {col}
                </p>
              ))
            )}
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Available Metrics</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {numericColumns.length === 0 ? (
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>None detected</p>
            ) : (
              numericColumns.slice(0, 5).map((col) => (
                <p key={col} style={{ margin: 0, fontSize: "11px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={col}>
                  • {col}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
