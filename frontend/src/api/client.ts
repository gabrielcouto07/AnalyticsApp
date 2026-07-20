import axios from "axios"
import { useSession } from "../store/session"

// Sobrescreva com VITE_API_URL (arquivo .env) se o backend rodar em outra porta
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export const api = axios.create({
  baseURL: API_BASE,
  // Workbooks fiscais de ~20MB levam ~10s para parsear no backend;
  // 30s derrubava o upload em arquivos grandes.
  timeout: 300000,
})

// Sessão morta/inválida (ex.: backend reiniciado e a sessão não foi encontrada
// nem no disco): limpamos a sessão do estado para o usuário voltar ao upload,
// em vez de ficar preso numa tela que faz 404 em loop. Só reage a endpoints
// que exigem sessão ativa (data/charts/export) — nunca ao próprio /upload.
const SESSION_SCOPED = /\/api\/(data|charts|export)\//

api.interceptors.response.use(
  r => r,
  error => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ""
    if (status === 404 && SESSION_SCOPED.test(url)) {
      const store = useSession.getState()
      if (store.sessionId) store.clear()
    }
    return Promise.reject(error)
  },
)
