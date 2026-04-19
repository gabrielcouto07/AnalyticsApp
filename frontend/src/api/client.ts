import axios from "axios"

export const api = axios.create({
  baseURL: "http://localhost:8001",
  timeout: 120000, // 120s — large .xlsm files can take 10-15s to parse
})
