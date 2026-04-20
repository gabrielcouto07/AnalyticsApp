import React from "react"

interface DashboardLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  maxWidth?: string
}

/**
 * Professional dashboard layout component
 * Provides consistent spacing, centering, and styling across all dashboards
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  description,
  children,
  maxWidth = "1600px"
}) => {
  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      backgroundColor: "#0f172a",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      {/* Header Section */}
      <div style={{
        width: "100%",
        maxWidth: maxWidth,
        marginBottom: "32px"
      }}>
        <h1 style={{
          margin: 0,
          fontSize: "28px",
          fontWeight: "700",
          color: "#f1f5f9",
          letterSpacing: "-0.5px"
        }}>
          {title}
        </h1>
        {description && (
          <p style={{
            margin: "8px 0 0 0",
            fontSize: "14px",
            color: "#94a3b8",
            fontWeight: "400",
            lineHeight: "1.6"
          }}>
            {description}
          </p>
        )}
      </div>

      {/* Content Container */}
      <div style={{
        width: "100%",
        maxWidth: maxWidth,
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        {children}
      </div>
    </div>
  )
}

/**
 * Card component for grouping related content
 * Use within DashboardLayout for consistent spacing and styling
 */
interface CardProps {
  title?: string
  description?: string
  children: React.ReactNode
  fullWidth?: boolean
  noPadding?: boolean
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  children,
  fullWidth = true,
  noPadding = false
}) => {
  return (
    <div style={{
      width: fullWidth ? "100%" : "auto",
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: noPadding ? "0" : "24px",
      transition: "all 0.3s ease",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
    }}>
      {(title || description) && (
        <div style={{
          marginBottom: noPadding ? "0" : "20px",
          paddingBottom: noPadding ? "0" : "20px",
          borderBottom: noPadding ? "none" : "1px solid #334155"
        }}>
          {title && (
            <h2 style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "600",
              color: "#f1f5f9",
              letterSpacing: "-0.3px"
            }}>
              {title}
            </h2>
          )}
          {description && (
            <p style={{
              margin: title ? "8px 0 0 0" : 0,
              fontSize: "13px",
              color: "#94a3b8",
              fontWeight: "400"
            }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

/**
 * KPI Grid component for displaying key metrics
 */
interface KPIGridProps {
  items: Array<{
    label: string
    value: string | number
    icon?: string
    suffix?: string
  }>
  columns?: number
}

export const KPIGrid: React.FC<KPIGridProps> = ({ items, columns = 4 }) => {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
      gap: "16px",
      width: "100%"
    }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: "rgba(79, 142, 247, 0.05)",
            border: "1px solid rgba(79, 142, 247, 0.2)",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.backgroundColor = "rgba(79, 142, 247, 0.1)"
            el.style.borderColor = "rgba(79, 142, 247, 0.4)"
            el.style.transform = "translateY(-2px)"
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.backgroundColor = "rgba(79, 142, 247, 0.05)"
            el.style.borderColor = "rgba(79, 142, 247, 0.2)"
            el.style.transform = "translateY(0)"
          }}
        >
          {item.icon && (
            <div style={{
              fontSize: "24px",
              marginBottom: "8px"
            }}>
              {item.icon}
            </div>
          )}
          <p style={{
            margin: "0 0 8px 0",
            fontSize: "12px",
            color: "#94a3b8",
            fontWeight: "500",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            {item.label}
          </p>
          <p style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#4f8ef7",
            letterSpacing: "-0.5px"
          }}>
            {item.value}{item.suffix ? ` ${item.suffix}` : ""}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * Section wrapper for grouping related content
 */
interface SectionProps {
  title: string
  children: React.ReactNode
  icon?: string
  variant?: "default" | "compact"
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  icon,
  variant = "default"
}) => {
  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: variant === "compact" ? "12px" : "16px",
        paddingBottom: variant === "compact" ? "8px" : "12px",
        borderBottom: "2px solid #334155"
      }}>
        {icon && <span style={{ fontSize: "20px" }}>{icon}</span>}
        <h3 style={{
          margin: 0,
          fontSize: variant === "compact" ? "14px" : "16px",
          fontWeight: "600",
          color: "#f1f5f9",
          letterSpacing: "-0.3px"
        }}>
          {title}
        </h3>
      </div>
      <div style={{ marginTop: variant === "compact" ? "12px" : "16px" }}>
        {children}
      </div>
    </div>
  )
}
