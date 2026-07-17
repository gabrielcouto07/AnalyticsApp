import axios from "axios"

// Sobrescreva com VITE_API_URL (arquivo .env) se o backend rodar em outra porta
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export const api = axios.create({
  baseURL: API_BASE,
  // Workbooks fiscais de ~20MB levam ~10s para parsear no backend;
  // 30s derrubava o upload em arquivos grandes.
  timeout: 300000,
})
