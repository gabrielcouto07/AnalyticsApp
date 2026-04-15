import { create } from "zustand"

interface ColTypes {
  date: string[]
  numeric: string[]
  categorical: string[]
}

interface KpiItem {
  title: string
  total: number
  mean: number
  trend?: number | null
}

interface QualityItem {
  column: string
  type: string
  nulls: number
  null_pct: number
  unique: number
  sample: string
}

interface SessionState {
  sessionId: string | null
  filename: string | null
  rows: number
  columns: number
  colTypes: ColTypes | null
  // Cache — preenchido uma vez após upload, lido por todas as abas
  kpis: KpiItem[]
  quality: QualityItem[]
  stats: Record<string, any>
  datasetType: string | null
  isLoading: boolean
  error: string | null
  setSession: (data: Partial<SessionState>) => void
  clear: () => void
}

export const useSession = create<SessionState>(set => ({
  sessionId: null,
  filename: null,
  rows: 0,
  columns: 0,
  colTypes: null,
  kpis: [],
  quality: [],
  stats: {},
  datasetType: null,
  isLoading: false,
  error: null,
  setSession: data => set(data),
  clear: () => set({
    sessionId: null,
    filename: null,
    rows: 0,
    columns: 0,
    colTypes: null,
    kpis: [],
    quality: [],
    stats: {},
    datasetType: null,
    isLoading: false,
    error: null,
  }),
}))
