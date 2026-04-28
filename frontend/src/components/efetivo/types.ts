export interface Summary {
  total_diarias: number
  unique_fornecedores: number
  unique_funcoes: number
  dias_ativos: number
  media_diaria: number
  obra: string
  ano: number
  meses_cobertos: number
  data_quality: { fornecedores: string[]; funcoes: string[] }
}

export interface FuncaoRow {
  dia: number
  fornecedor: string
  funcao: string
  quantidade: number
}

export interface MonthData {
  mes: number
  mes_nome: string
  fornecedores: string[]
  daily_pivot: Record<string, any>[]
  funcao_detail: FuncaoRow[]
}

export interface TrendData {
  direction: "up" | "down" | "flat" | "unknown"
  slope?: number
  r_squared?: number
  strength?: "forte" | "moderada" | "fraca"
}

export interface AnomalyPoint {
  data: string
  valor: number
}

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
  filial: string
  funcionarios: number
  percentage: number
}
