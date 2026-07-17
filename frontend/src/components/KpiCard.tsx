import { fmt } from "../lib/format"

const COLORS = ["#3987e5", "#c98500", "#199e70", "#9085e9"]

interface Props {
  title: string
  total: number
  mean?: number | null
  trend?: number | null
  format?: "currency" | "number"
  /** Texto do comparativo (ex.: "vs mês anterior", "vs 2025") */
  trendLabel?: string
  /** Linha secundária customizada (substitui a média) */
  subtitle?: string
  index?: number
}

export function KpiCard({ title, total, mean, trend, format = "number", trendLabel = "vs mês anterior", subtitle, index = 0 }: Props) {
  const color = COLORS[index % COLORS.length]
  const up    = typeof trend === "number" && trend > 0
  const down  = typeof trend === "number" && trend < 0

  const big   = format === "currency" ? fmt.currencyCompact(total) : fmt.compact(total)
  const exact = format === "currency" ? fmt.currency(total) : fmt.number(total)

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3
                 hover:border-primary/40 transition-all duration-200 min-w-0"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Linha 1: label */}
      <p className="text-xs font-semibold text-muted uppercase tracking-wide truncate" title={title}>
        {title}
      </p>

      {/* Linha 2: valor principal — grande e bold, valor exato logo abaixo */}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text leading-none truncate" title={exact}>
          {big}
        </p>
        <p className="text-[11px] text-faint mt-1 truncate">{exact}</p>
      </div>

      {/* Linha 3: média/subtítulo + badge de tendência */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 min-w-0">
        <span className="text-xs text-muted truncate">
          {subtitle ?? (typeof mean === "number"
            ? <>Média: <span className="text-text font-medium">
                {format === "currency" ? fmt.currencyCompact(mean) : fmt.compact(mean)}
              </span></>
            : "")}
        </span>

        {typeof trend === "number" && (
          <span
            role="status"
            aria-label={`${up ? "Alta" : down ? "Queda" : "Estável"} de ${Math.abs(trend).toFixed(1)}% ${trendLabel}`}
            title={trendLabel}
            className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap
            ${up   ? "bg-success/15 text-success" : ""}
            ${down ? "bg-danger/15  text-danger"  : ""}
            ${!up && !down ? "bg-muted/15 text-muted" : ""}`}>
            {up ? "↑" : down ? "↓" : "→"} {Math.abs(trend).toFixed(1).replace(".", ",")}%
          </span>
        )}
      </div>
    </div>
  )
}
