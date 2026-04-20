import { fmt } from "../lib/format"

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"]
const ICONS = ["💰", "📊", "📈", "🔢"]
const BG_COLORS = ["rgba(59, 130, 246, 0.1)", "rgba(139, 92, 246, 0.1)", "rgba(16, 185, 129, 0.1)", "rgba(245, 158, 11, 0.1)"]

interface Props {
  title: string
  total: number
  mean: number
  trend?: number | null
  index?: number
}

export function KpiCard({ title, total, mean, trend, index = 0 }: Props) {
  const color = COLORS[index % COLORS.length]
  const bgColor = BG_COLORS[index % BG_COLORS.length]
  const icon  = ICONS[index % ICONS.length]
  const up    = typeof trend === "number" && trend > 0
  const down  = typeof trend === "number" && trend < 0

  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.7) 100%)`,
        border: `1px solid ${color}40`,
        borderLeft: `4px solid ${color}`,
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
      }}
      className="hover:scale-105 hover:shadow-2xl"
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = color
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${color}40`
      }}
    >
      {/* Cabeçalho: ícone + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          fontSize: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          backgroundColor: bgColor,
          borderRadius: "10px",
        }}>
          {icon}
        </div>
        <p style={{
          margin: 0,
          fontSize: "12px",
          fontWeight: "700",
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
          {title}
        </p>
      </div>

      {/* Valor principal - grande e destaque */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{
          margin: 0,
          fontSize: "32px",
          fontWeight: "900",
          color: color,
          lineHeight: 1,
        }}>
          {fmt.compact(total)}
        </p>
        <p style={{
          margin: 0,
          fontSize: "12px",
          color: "#64748b",
        }}>
          Total: {fmt.number(total)}
        </p>
      </div>

      {/* Média + Trend */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        paddingTop: "12px",
        borderTop: "1px solid rgba(51, 65, 85, 0.3)",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
            Média
          </p>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "16px",
            fontWeight: "700",
            color: "#cbd5e1"
          }}>
            {fmt.compact(mean)}
          </p>
        </div>

        {typeof trend === "number" && (
          <div style={{
            background: up ? "rgba(16, 185, 129, 0.15)" : down ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)",
            color: up ? "#10b981" : down ? "#ef4444" : "#94a3b8",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            whiteSpace: "nowrap"
          }}>
            <span>{up ? "↑" : down ? "↓" : "→"}</span>
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
