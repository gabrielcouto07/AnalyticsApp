import { api, API_BASE } from "./client"

export const uploadFile = async (file: File, sheet?: string) => {
  const form = new FormData()
  form.append("file", file)
  if (sheet) form.append("sheet", sheet)
  const { data } = await api.post("/api/upload", form)
  return data  // { session_id, filename, rows, columns, col_types, preview, model, sheets, meaningful_columns, datasets }
}

export const getKpis = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/kpis`).then(r => r.data)

export const getQuality = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/quality`).then(r => r.data)

export const getStats = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/stats`).then(r => r.data)

export interface DashboardParams {
  ano?: number
  mes?: number | null
  excluir_intercompany?: boolean
}

export const getDashboard = (sessionId: string, params: DashboardParams = {}) =>
  api.get(`/api/data/${sessionId}/dashboard`, {
    params: {
      ano: params.ano,
      mes: params.mes ?? undefined,
      excluir_intercompany: params.excluir_intercompany ?? false,
    },
  }).then(r => r.data)

export interface TableParams {
  dataset?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_dir?: "asc" | "desc"
  columns?: string[]
  search?: string
}

export const getTable = (sessionId: string, params: TableParams = {}) =>
  api.get(`/api/data/${sessionId}/table`, {
    params: {
      dataset: params.dataset,
      page: params.page ?? 1,
      page_size: params.page_size ?? 50,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir ?? "asc",
      columns: params.columns?.length ? params.columns.join(",") : undefined,
      search: params.search || undefined,
    },
  }).then(r => r.data)

export const getTemporalChart = (sessionId: string, payload: object) =>
  api.post(`/api/charts/${sessionId}/temporal`, payload).then(r => r.data)

export const getCrossChart = (sessionId: string, payload: object) =>
  api.post(`/api/charts/${sessionId}/cross`, payload).then(r => r.data)

export const getDistribution = (sessionId: string, column: string, bins = 30) =>
  api.post(`/api/charts/${sessionId}/distribution`, { column, bins }).then(r => r.data)

export const getCorrelation = (sessionId: string) =>
  api.get(`/api/charts/${sessionId}/correlation`).then(r => r.data)

/** URL de exportação da visão atual (dataset + colunas + ordenação) */
export const exportUrl = (
  sessionId: string,
  format: "excel" | "csv",
  view: { dataset?: string; columns?: string[]; sort_by?: string; sort_dir?: "asc" | "desc" } = {},
) => {
  const params = new URLSearchParams()
  if (view.dataset) params.set("dataset", view.dataset)
  if (view.columns?.length) params.set("columns", view.columns.join(","))
  if (view.sort_by) {
    params.set("sort_by", view.sort_by)
    params.set("sort_dir", view.sort_dir ?? "asc")
  }
  const qs = params.toString()
  return `${API_BASE}/api/export/${sessionId}/${format}${qs ? `?${qs}` : ""}`
}
