import {
  fetchApiJson,
  type EfetivoAnalysisResponse,
  type EfetivoMonthData,
  type EfetivoSummary,
} from "../../api/analytics"
import type { BranchRow, WorkRow } from "./types"

export async function fetchEfetivoBase(sessionId: string): Promise<{
  summary: EfetivoSummary | null
  months: EfetivoMonthData[]
}> {
  const [analysis, months] = await Promise.all([
    fetchApiJson<EfetivoAnalysisResponse>(`/api/templates/efetivo/analysis/${sessionId}`),
    fetchApiJson<EfetivoMonthData[]>(`/api/templates/efetivo/monthly-breakdown/${sessionId}`),
  ])

  return {
    summary: analysis.summary,
    months,
  }
}

export function buildWorkRows(
  summary: EfetivoSummary | null,
  months: EfetivoMonthData[],
): WorkRow[] {
  return months.flatMap((month) =>
    (month.funcao_detail ?? [])
      .filter((row) => Number(row.quantidade) > 0)
      .map((row) => ({
        filial: row.obra?.trim() || summary?.obra?.trim() || "Obra nao identificada",
        fornecedor: row.fornecedor || "-",
        cargo: row.funcao || "-",
        periodo: month.mes_nome || String(month.mes),
        mes: month.mes,
        dia: row.dia,
        quantidade: Number(row.quantidade) || 0,
      })),
  )
}

export function buildBranchRows(workRows: WorkRow[]): BranchRow[] {
  const totalFuncionarios = workRows.reduce((sum, row) => sum + row.quantidade, 0)
  return Array.from(
    workRows.reduce((acc, row) => {
      acc.set(row.filial, (acc.get(row.filial) ?? 0) + row.quantidade)
      return acc
    }, new Map<string, number>()),
  )
    .map(([obra, funcionarios]) => ({
      obra,
      funcionarios,
      percentage: totalFuncionarios ? Math.round((funcionarios / totalFuncionarios) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.funcionarios - left.funcionarios)
}

export function buildCompleteness(workRows: WorkRow[]): number {
  if (workRows.length === 0) return 0
  const fields: Array<keyof WorkRow> = ["filial", "fornecedor", "cargo", "periodo", "dia", "quantidade"]
  const completeCells = workRows.reduce(
    (sum, row) =>
      sum +
      fields.filter((field) => {
        const value = row[field]
        return value !== null && value !== undefined && String(value).trim() !== ""
      }).length,
    0,
  )
  return Math.round((completeCells / (workRows.length * fields.length)) * 100)
}

export function buildEvolutionData(workRows: WorkRow[]) {
  return Array.from(
    workRows.reduce((acc, row) => {
      const current = acc.get(row.mes) ?? { periodo: row.periodo, mes: row.mes, funcionarios: 0 }
      current.funcionarios += row.quantidade
      acc.set(row.mes, current)
      return acc
    }, new Map<number, { periodo: string; mes: number; funcionarios: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => left.mes - right.mes)
}
