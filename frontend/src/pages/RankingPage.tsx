import { useState } from "react"
import { useSession } from "../store/session"

// Ranking and top values analysis
export function RankingPage() {
  const { colTypes } = useSession()
  const [selectedColumn, setSelectedColumn] = useState<string>(colTypes?.categorical?.[0] ?? "")
  const [limit, setLimit] = useState(10)

  const categoricalColumns = colTypes?.categorical ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Rankings</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Top values and frequency analysis</p>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        {/* Column Selector */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Category Column
          </label>
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
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
            <option value="">Select a categorical column...</option>
            {categoricalColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* Limit Selector */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Show Top
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
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
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Card */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Statistics</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
          {[
            { label: "Distinct Values", value: "—" },
            { label: "Most Frequent", value: "—" },
            { label: "Frequency", value: "—%" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{label}</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#f1f5f9" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155", backgroundColor: "rgba(15, 23, 42, 0.5)" }}>
                {["Rank", "Value", "Count", "Percentage", "Bar"].map((header) => (
                  <th key={header} style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(limit)].map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(15, 23, 42, 0.3)" }}>
                  <td style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: "700" }}>#{i + 1}</td>
                  <td style={{ padding: "12px 16px", color: "#f1f5f9", fontWeight: "500" }}>—</td>
                  <td style={{ padding: "12px 16px", color: "#4f8ef7", fontWeight: "600" }}>—</td>
                  <td style={{ padding: "12px 16px", color: "#10b981" }}>—</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ height: "4px", width: "60px", backgroundColor: "#334155", borderRadius: "2px" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {categoricalColumns.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#94a3b8" }}>
            <p style={{ margin: 0, fontSize: "14px" }}>No categorical columns available</p>
          </div>
        )}
      </div>

      {/* Available Columns */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Available Categorical Columns</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {categoricalColumns.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>No categorical columns detected</p>
          ) : (
            categoricalColumns.map((col) => (
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
