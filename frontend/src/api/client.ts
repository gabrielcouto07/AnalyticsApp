import axios from "axios"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

export const templatesApiUrl = (path: string): string => `${API_BASE_URL}/api/templates${path}`
