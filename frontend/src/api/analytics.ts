import type { AxiosProgressEvent } from 'axios'

import { api } from './client'

export interface UploadResponse {
  session_id: string
  filename: string
  rows: number
  columns: number
  format?: string
  col_types: Record<string, string>
  preview: Record<string, unknown>[]
  template: string | null
  detected_schema: string[]
  schema_types?: string[]
  detected_sheets?: string[]
}

export interface EfetivoSummary {
  total_diarias: number
  unique_fornecedores: number
  unique_funcoes: number
  dias_ativos: number
  media_diaria: number
  obra: string
  ano: number
  meses_cobertos: number
  data_quality: {
    fornecedores: string[]
    funcoes: string[]
  }
}

export interface EfetivoFuncaoRow {
  dia: number
  obra?: string
  fornecedor: string
  funcao: string
  quantidade: number
}

export interface EfetivoDailyPivotRow {
  Dia: number
  [key: string]: string | number | null | undefined
}

export interface EfetivoMonthData {
  mes: number
  mes_nome: string
  fornecedores: string[]
  daily_pivot: EfetivoDailyPivotRow[]
  funcao_detail: EfetivoFuncaoRow[]
}

export interface EfetivoTrendResponse {
  direction: 'up' | 'down' | 'flat' | 'unknown'
  slope?: number
  r_squared?: number
  strength?: 'forte' | 'moderada' | 'fraca'
}

export interface EfetivoAnomalyPoint {
  data: string
  valor: number
  zscore?: number
}

export interface EfetivoAnalysisResponse {
  summary: EfetivoSummary | null
  error?: string
}

export interface EfetivoAnomaliesResponse {
  points: EfetivoAnomalyPoint[]
}

export interface NaturezaValue {
  natureza: string
  valor: number
}

export interface CustosNfsRow {
  "Nº CONSOLIDADO"?: string | number | null
  COD?: string | null
  FORNECEDOR?: string | null
  NF?: string | number | null
  "MAPA PREÇOS"?: string | null
  NATUREZA?: string | null
  "BOLETO/DEPÓSITO"?: string | null
  "DATA VENCTO"?: string | null
  VALOR?: number | string | null
  "SITUAÇÃO PLANILHA"?: string | null
  "SALDO PLANILHA"?: number | string | null
  [key: string]: string | number | null | undefined
}

export type CustosNfsResponse = CustosNfsRow[]

export interface CustosConsolidadoRow {
  "Nº CONSOLIDADO"?: string | number | null
  FORNECEDOR?: string | null
  NF?: string | number | null
  MAPA?: string | null
  NATUREZA?: string | null
  "COND.PAGTO"?: string | null
  "DATA VENCTO"?: string | null
  VALOR?: number | string | null
  "ITEM APROPRIAÇÃO"?: string | null
  "VALOR APROPRIADO"?: number | string | null
  [key: string]: string | number | null | undefined
}

export type CustosConsolidadoResponse = CustosConsolidadoRow[]

export interface CustosOrcadoRealizadoPeriodo {
  periodo: number
  desembolso: number
}

export interface CustosOrcadoRealizadoItem {
  item: string
  descricao: string
  verba_total: number
  periodos: CustosOrcadoRealizadoPeriodo[]
}

export type CustosOrcadoRealizadoResponse = CustosOrcadoRealizadoItem[]

export interface CustosResumoRow {
  "Nº CONSOLIDADO"?: string | number | null
  "MATERIAL/SERVIÇO"?: number | string | null
  "MÃO OBRA EMPREITADA"?: number | string | null
  "MÃO OBRA TEMPO"?: number | string | null
  STAFF?: number | string | null
  "SERVIÇO sem TAXA ADM"?: number | string | null
  TOTAL?: number | string | null
  "TAXA ADMINISTRAÇÃO"?: number | string | null
  "DATA VENCTO"?: string | null
  "DATA RECBTO"?: string | null
  "TOTAL GERAL"?: number | string | null
  [key: string]: string | number | null | undefined
}

export type CustosResumoResponse = CustosResumoRow[]

export interface OrcamentoFlatRow {
  ITEM?: string | number | null
  SUBITEM?: string | number | null
  "DESCRIÇÃO"?: string | null
  UNID?: string | null
  QTD?: number | string | null
  "CUSTO UNITÁRIO"?: number | string | null
  "CUSTO TOTAL"?: number | string | null
  [key: string]: string | number | null | undefined
}

export type OrcamentoFlatResponse = OrcamentoFlatRow[]

export interface OrcamentoMapaRow {
  ITEM?: string | number | null
  SUBITEM?: string | number | null
  MAPA?: string | number | null
  VALOR_MAPA?: number | string | null
  [key: string]: string | number | null | undefined
}

export type OrcamentoMapasResponse = OrcamentoMapaRow[]

export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<UploadResponse>('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!onProgress || !event.total) return
      const percent = Math.round((event.loaded * 100) / event.total)
      onProgress(percent)
    },
  })
  return data
}

export async function fetchApiJson<T>(path: string): Promise<T> {
  const { data } = await api.get<T>(path)
  return data
}
