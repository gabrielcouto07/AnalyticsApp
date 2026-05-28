import { fmt } from "../lib/format"

const COLORS = ["#4f8ef7", "#a78bfa", "#34c97e", "#f59e0b"]
const ICONS = ["💰", "📦", "📈", "🔢"]

interface Props {
  title: string
  total: number
  mean: number
  trend?: number | null
  index?: number
}

export function KpiCard({ title, total, mean, trend, index = 0 }: Props) {
  const color = COLORS[index % COLORS.length]
  const icon  = ICONS[index % ICONS.length]
  const up    = typeof trend === "number" && trend > 0
  const down  = typeof trend === "number" && trend < 0

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3
                 hover:border-primary/40 transition-all duration-200 min-w-0"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Linha 1: ícone + label */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{icon}</span>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide truncate">
          {title}
        </p>
      </div>

      {/* Linha 2: valor principal — grande e bold */}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text leading-none truncate">
          {fmt.compact(total)}
        </p>
        <p className="text-[11px] text-faint mt-1">
          Total: {fmt.number(total)}
        </p>
      </div>

      {/* Linha 3: média + trend badge — sempre na base */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 min-w-0">
        <span className="text-xs text-muted truncate">
          Média: <span className="text-text font-medium">{fmt.compact(mean)}</span>
        </span>

        {typeof trend === "number" && (
          <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap
            ${up   ? "bg-success/15 text-success" : ""}
            ${down ? "bg-danger/15  text-danger"  : ""}
            ${!up && !down ? "bg-muted/15 text-muted" : ""}`}>
            {up ? "↑" : down ? "↓" : "→"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}
