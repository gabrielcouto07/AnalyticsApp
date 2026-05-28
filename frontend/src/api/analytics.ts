import { api } from "./client"

export const uploadFile = async (file: File) => {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post("/api/upload", form)
  return data  // { session_id, filename, rows, columns, col_types, preview }
}

export const getKpis = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/kpis`).then(r => r.data)

export const getQuality = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/quality`).then(r => r.data)

export const getStats = (sessionId: string) =>
  api.get(`/api/data/${sessionId}/stats`).then(r => r.data)

export const getTemporalChart = (sessionId: string, payload: object) =>
  api.post(`/api/charts/${sessionId}/temporal`, payload).then(r => r.data)

export const getCrossChart = (sessionId: string, payload: object) =>
  api.post(`/api/charts/${sessionId}/cross`, payload).then(r => r.data)

export const getCorrelation = (sessionId: string) =>
  api.get(`/api/charts/${sessionId}/correlation`).then(r => r.data)
