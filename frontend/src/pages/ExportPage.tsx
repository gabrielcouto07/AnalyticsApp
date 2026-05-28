import { useState } from "react"
import { useSession } from "../store/session"

// Export data in multiple formats
export function ExportPage() {
  const { filename, rows, columns } = useSession()
  const [loading, setLoading] = useState<"excel" | "csv" | null>(null)

  const handleExport = async (format: "excel" | "csv") => {
    setLoading(format)
    try {
      const response = await fetch(
        `http://localhost:8000/api/export/${format}`,
        { method: "GET" }
      )
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename?.replace(/\.[^/.]+$/, "") || "export"}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export error:", error)
      alert("Export failed. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>Export Data</h2>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#cbd5e1" }}>Download your analyzed data in multiple formats</p>
      </div>

      {/* File Info Card */}
      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "24px" }}>📄</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f1f5f9" }}>{filename || "dataset.xlsx"}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#94a3b8" }}>
              {rows?.toLocaleString()} rows × {columns} columns
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", paddingTop: "12px", borderTop: "1px solid #1e293b" }}>
          {[
            { name: "Excel", format: "excel", icon: "📊", color: "#10b981" },
            { name: "CSV", format: "csv" as const, icon: "📋", color: "#4f8ef7" },
          ].map(({ name, format, icon, color }) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={loading !== null}
              style={{
                padding: "12px 16px",
                backgroundColor: loading === format ? color : "rgba(30, 41, 59, 0.5)",
                border: `2px solid ${color}`,
                borderRadius: "8px",
                color: "#f1f5f9",
                fontWeight: "600",
                fontSize: "13px",
                cursor: loading === null ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s",
                opacity: loading !== null && loading !== format ? 0.5 : 1,
              }}
            >
              {loading === format ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "14px" }}>⏳</span>
                  Exporting...
                </>
              ) : (
                <>
                  {icon}
                  {name}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        {[
          {
            title: "Excel Format",
            description: "Include formatting, charts, and multiple sheets",
            icon: "📊",
            features: ["Column headers", "Data types", "Formulas ready"],
          },
          {
            title: "CSV Format",
            description: "Universal format compatible with all tools",
            icon: "📋",
            features: ["Standard encoding", "No formatting", "Lightweight"],
          },
        ].map(({ title, description, icon, features }) => (
          <div key={title} style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "28px" }}>{icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#f1f5f9" }}>{title}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>{description}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "12px", borderTop: "1px solid #1e293b" }}>
              {features.map((feature) => (
                <p key={feature} style={{ margin: 0, fontSize: "11px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#10b981" }}>✓</span>
                  {feature}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{ backgroundColor: "rgba(79, 142, 247, 0.1)", border: "1px solid rgba(79, 142, 247, 0.3)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px" }}>
        <span style={{ fontSize: "16px", marginTop: "2px" }}>ℹ️</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#f1f5f9" }}>Export Information</p>
          <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>
            Your data will be downloaded with all calculated metrics, quality scores, and cleaned values ready for further analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
