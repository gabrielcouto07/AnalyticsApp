import { fmt } from "./format"

const DASH = "—"
const isDateDtype = (dtype?: string) => !!dtype && /datetime|date/i.test(dtype)
const isNumericDtype = (dtype?: string) =>
  !!dtype && /int|float|number/i.test(dtype) && !/datetime/i.test(dtype)

/**
 * Converte QUALQUER valor vindo da API em um texto seguro para renderizar como
 * filho React. Nunca deixa um objeto/array cru virar filho React (o que quebra
 * a renderização) e nunca mostra "NaN"/"undefined"/"[object Object]" ao usuário.
 */
export function safeCell(value: unknown, dtype?: string): string {
  if (value === null || value === undefined || value === "") return DASH

  if (typeof value === "boolean") return value ? "Sim" : "Não"

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return DASH   // NaN / Infinity
    return fmt.number(value)
  }

  if (typeof value === "bigint") return value.toString()

  if (typeof value === "string") {
    if (isDateDtype(dtype)) {
      const d = new Date(value)
      return isNaN(d.getTime()) ? value : fmt.date(value)
    }
    if (isNumericDtype(dtype)) {
      const n = Number(value)
      return Number.isFinite(n) ? fmt.number(n) : value
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(v => safeCell(v)).join(", ")
  }

  if (typeof value === "object") {
    // Objeto inesperado — NUNCA renderizar cru como filho React.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[safeCell] valor de tipo objeto inesperado numa célula:", value)
    }
    try {
      const s = JSON.stringify(value)
      return s.length > 80 ? s.slice(0, 77) + "…" : s
    } catch {
      return DASH
    }
  }

  return String(value)
}
