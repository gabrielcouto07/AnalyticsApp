// Wrapper component for charts that provides consistent styling and header

import { type ReactNode } from "react"

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  loading?: boolean
}

export function ChartCard({ title, subtitle, children, action, loading }: ChartCardProps) {
  return (
    <div style={{
      backgroundColor: "rgba(30, 41, 59, 0.6)",
      border: "1px solid #334155",
      borderRadius: "14px",
      overflow: "hidden",
      opacity: loading ? 0.6 : 1,
      transition: "all 0.3s ease",
      backdropFilter: "blur(8px)"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px",
        borderBottom: "1px solid #334155"
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: "700",
            color: "#f1f5f9",
            letterSpacing: "-0.3px"
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{
              margin: "6px 0 0 0",
              fontSize: "12px",
              color: "#94a3b8",
              fontWeight: "500"
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div style={{ marginLeft: "16px", flexShrink: 0 }}>
            {action}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "16px" }}>
        {children}
      </div>
    </div>
  )
}
