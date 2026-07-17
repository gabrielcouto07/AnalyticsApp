import { create } from "zustand"

interface ColTypes {
  date: string[]
  numeric: string[]
  categorical: string[]
}

export interface KpiItem {
  title: string
  total: number
  mean: number
  trend?: number | null
  format?: "currency" | "number"
}

export interface QualityItem {
  column: string
  type: string
  nulls: number
  null_pct: number
  unique: number
  sample: string
}

export interface SheetInfo {
  name: string
  role: "data" | "ignore" | "lookup"
  model: "fiscal" | "venda" | null
  rows: number
  columns: number
  selected: boolean
}

interface SessionState {
  sessionId: string | null
  filename: string | null
  rows: number
  columns: number
  colTypes: ColTypes | null
  // Modelo detectado no upload ("medical_fiscal" ganha dashboard executivo)
  model: string | null
  sheets: SheetInfo[]
  meaningfulColumns: string[]
  datasets: string[]
  // Cache — preenchido uma vez após upload, lido por todas as abas
  kpis: KpiItem[]
  quality: QualityItem[]
  stats: Record<string, any>
  datasetType: { type: string; description: string } | string | null
  isLoading: boolean
  error: string | null
  setSession: (data: Partial<SessionState>) => void
  clear: () => void
}

const EMPTY = {
  sessionId: null,
  filename: null,
  rows: 0,
  columns: 0,
  colTypes: null,
  model: null,
  sheets: [] as SheetInfo[],
  meaningfulColumns: [] as string[],
  datasets: [] as string[],
  kpis: [] as KpiItem[],
  quality: [] as QualityItem[],
  stats: {},
  datasetType: null,
  isLoading: false,
  error: null,
}

export const useSession = create<SessionState>(set => ({
  ...EMPTY,
  setSession: data => set(data),
  clear: () => set(EMPTY),
}))
