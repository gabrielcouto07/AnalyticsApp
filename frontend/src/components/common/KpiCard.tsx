// Metric card component that displays a KPI with optional trend indicator

import { fmt } from "../../lib"

interface KpiCardProps {
  title: string
  value: number
  unit?: string
  trend?: number
  color?: "primary" | "success" | "warning" | "danger"
  icon?: string
  format?: "number" | "compact" | "currency" | "percent"
}

export function KpiCard({
  title,
  value,
  unit,
  trend,
  color = "primary",
  icon,
  format = "number",
}: KpiCardProps) {
  const colorMap = {
    primary: "#4f8ef7",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  }

  const formatMap = {
    number: fmt.number,
    compact: fmt.compact,
    currency: fmt.currency,
    percent: fmt.percent,
  }

  const formatter = formatMap[format]
  const trendColor = trend && trend > 0 ? "#10b981" : "#ef4444"

  return (
    <div style={{
      borderRadius: "14px",
      border: "1px solid #334155",
      padding: "20px",
      backgroundColor: "rgba(30, 41, 59, 0.6)",
      backdropFilter: "blur(8px)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      transition: "all 0.3s ease"
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = "#4f8ef7"
      el.style.backgroundColor = "rgba(30, 41, 59, 0.9)"
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = "#334155"
      el.style.backgroundColor = "rgba(30, 41, 59, 0.6)"
    }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "start",
        justifyContent: "space-between"
      }}>
        <div>
          <p style={{
            margin: 0,
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "#94a3b8"
          }}>
            {title}
          </p>
        </div>
        {icon && <span style={{ fontSize: "24px" }}>{icon}</span>}
      </div>

      {/* Value */}
      <div>
        <p style={{
          margin: 0,
          fontSize: "28px",
          fontWeight: "800",
          color: colorMap[color],
          letterSpacing: "-0.5px"
        }}>
          {formatter(value)}
          {unit && <span style={{ fontSize: "14px", fontWeight: "500", marginLeft: "6px" }}>{unit}</span>}
        </p>
      </div>

      {/* Trend */}
      {trend !== undefined && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingTop: "12px",
          borderTop: "1px solid #334155"
        }}>
          <span style={{
            fontSize: "12px",
            fontWeight: "700",
            color: trendColor
          }}>
            {trend > 0 ? "↑" : "↓"} {fmt.percent(Math.abs(trend))}
          </span>
          <span style={{
            fontSize: "11px",
            color: "#94a3b8",
            fontWeight: "500"
          }}>
            vs. previous period
          </span>
        </div>
      )}
    </div>
  )
}
