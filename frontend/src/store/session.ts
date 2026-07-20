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
  role: string
  model: "fiscal" | "venda" | null
  rows: number
  columns: number
  selected: boolean
}

/** Metadados de fonte analítica + avisos, expostos na UI (aditivo). */
export interface SourceMeta {
  workbook_model?: string | null
  fact_source?: string | null
  fallback_used?: boolean
  sheets?: Record<string, string>
  warnings?: { level: "info" | "partial" | "error"; message: string }[]
}

/** Detalhe técnico recolhível de uma falha de upload (nunca traceback cru). */
export interface UploadErrorDetail {
  stage?: string | null
  code?: string | null
  filename?: string | null
  timestamp: string
}

export type UploadStatus = "idle" | "processing" | "ready" | "failed"

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
  source: SourceMeta | null
  // Cache — preenchido uma vez após upload, lido por todas as abas
  kpis: KpiItem[]
  quality: QualityItem[]
  stats: Record<string, any>
  datasetType: { type: string; description: string } | string | null
  isLoading: boolean
  error: string | null

  // ---- Fluxo de upload transacional (não destrói a sessão anterior) ----
  status: UploadStatus
  uploadError: string | null
  uploadErrorDetail: UploadErrorDetail | null

  /** Marca início do processamento SEM tocar na sessão ativa atual. */
  beginUpload: () => void
  /** Ativa uma nova sessão atomicamente (só chamado após todos os passos ok). */
  activateSession: (data: Partial<SessionState>) => void
  /** Registra falha em pt-BR preservando a sessão válida anterior. */
  failUpload: (message: string, detail?: Partial<UploadErrorDetail>) => void
  /** Limpa apenas o erro de upload (some com o aviso, mantém a sessão). */
  clearUploadError: () => void

  setSession: (data: Partial<SessionState>) => void
  /** Remove uma sessão inválida/morta (ex.: 404 após restart do backend). */
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
  source: null,
  kpis: [] as KpiItem[],
  quality: [] as QualityItem[],
  stats: {},
  datasetType: null,
  isLoading: false,
  error: null,
  status: "idle" as UploadStatus,
  uploadError: null,
  uploadErrorDetail: null,
}

export const useSession = create<SessionState>(set => ({
  ...EMPTY,

  beginUpload: () => set({ status: "processing", uploadError: null, uploadErrorDetail: null }),

  activateSession: data =>
    set({ ...data, status: "ready", uploadError: null, uploadErrorDetail: null, isLoading: false }),

  failUpload: (message, detail) =>
    set({
      status: "failed",
      uploadError: message,
      uploadErrorDetail: { timestamp: new Date().toISOString(), ...detail },
      isLoading: false,
      // NOTA: sessionId/model/kpis etc. permanecem intactos de propósito.
    }),

  clearUploadError: () => set({ uploadError: null, uploadErrorDetail: null, status: "idle" }),

  setSession: data => set(data),
  clear: () => set(EMPTY),
}))
