export const fmtMoeda = (v: number | null | undefined): string =>
  v == null
    ? "—"
    : `R$ ${v.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`

export const fmtNum = (v: number | null | undefined): string =>
  v == null ? "—" : v.toLocaleString("pt-BR")

export const fmtPct = (v: number | null | undefined, decimals = 1): string =>
  v == null ? "—" : `${v.toFixed(decimals)}%`

export const fmtData = (v: string | null | undefined): string => {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR")
}

export const fmtTrend = (v: number): { label: string; color: string; icon: string } => {
  if (v > 2) return { label: "Crescendo", color: "text-red-400", icon: "↑" }
  if (v < -2) return { label: "Caindo", color: "text-green-400", icon: "↓" }
  return { label: "Estável", color: "text-gray-400", icon: "→" }
}

export function formatBRL(value: number | null | undefined): string {
  return fmtMoeda(value)
}

export function formatInt(value: number | null | undefined): string {
  return fmtNum(value == null ? value : Math.round(value))
}

export function formatDiarias(value: number | null | undefined): string {
  if (value == null) return "—"
  const decimals = value % 1 !== 0 ? 1 : 0
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 1,
  })
}

export function formatPct(value: number | null | undefined): string {
  return fmtPct(value)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (value instanceof Date) return value.toLocaleDateString("pt-BR")
  return fmtData(value)
}
