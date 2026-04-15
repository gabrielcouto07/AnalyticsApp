interface KpiCardProps {
  title: string
  total: number
  mean: number
  trend?: number | null
  index?: number
}

const ACCENT_COLORS = ["#4f8ef7", "#a78bfa", "#34c97e", "#f59e0b"]

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n)

export function KpiCard({ title, total, mean, trend, index = 0 }: KpiCardProps) {
  const color = ACCENT_COLORS[index % ACCENT_COLORS.length]
  const hasPositiveTrend = typeof trend === "number" && trend > 0
  const hasNegativeTrend = typeof trend === "number" && trend < 0

  return (
    <div
      className="relative bg-gradient-to-br from-card via-card/80 to-card/60 rounded-2xl p-6 border border-primary/20
                 hover:border-primary/60 transition-all duration-300 overflow-hidden group
                 shadow-xl hover:shadow-2xl hover:scale-105 cursor-pointer"
      style={{ borderLeft: `4px solid ${color}`, borderTopLeftRadius: '16px' }}
    >
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-2xl"
        style={{ 
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 50%, transparent 100%)`
        }}
      />

      {/* Animated Accent */}
      <div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full opacity-0 group-hover:opacity-20 group-hover:blur-3xl transition-all duration-500"
        style={{ background: color }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-bold text-muted/70 uppercase tracking-widest truncate flex-1">
            {title}
          </p>
          <div className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">{['📊', '📈', '✓', '⭐'][index % 4]}</div>
        </div>

        <p className="text-4xl font-black bg-gradient-to-r from-text to-text/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-secondary transition-all duration-300">
          {fmt(total)}
        </p>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary/10">
          <span className="text-xs text-muted/80 font-medium">Média: <span className="text-primary font-bold">{fmt(mean)}</span></span>

          {typeof trend === "number" && (
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-300
              ${hasPositiveTrend ? "bg-success/20 text-success shadow-lg shadow-success/20" : ""}
              ${hasNegativeTrend ? "bg-danger/20 text-danger shadow-lg shadow-danger/20" : ""}
              ${trend === 0 ? "bg-muted/20 text-muted/80" : ""}`}
            >
              {hasPositiveTrend ? "📈" : hasNegativeTrend ? "📉" : "→"} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Border Glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )
}
