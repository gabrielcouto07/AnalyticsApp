export type {
  EfetivoAnomalyPoint as AnomalyPoint,
  EfetivoFuncaoRow as FuncaoRow,
  EfetivoMonthData as MonthData,
  EfetivoSummary as Summary,
  EfetivoTrendResponse as TrendData,
} from "../../api/analytics"

export type EfetivoTab = "visao-geral" | "por-filial" | "evolucao" | "detalhamento"
export type DetailSortKey = "filial" | "fornecedor" | "cargo" | "periodo" | "dia" | "quantidade"

export interface WorkRow {
  filial: string
  fornecedor: string
  cargo: string
  periodo: string
  mes: number
  dia: number
  quantidade: number
}

export interface BranchRow {
  obra: string
  funcionarios: number
  percentage: number
}
