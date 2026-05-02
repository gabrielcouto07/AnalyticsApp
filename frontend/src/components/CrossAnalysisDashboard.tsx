import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { fetchApiJson } from "../api/analytics"

type CrossTab = "vinculacao" | "comparacao" | "previsao" | "dataset"

type LinkageResponse = {
  linked: boolean
  project_code: string | null
  confidence: number
  method: string
}

type ComparisonResponse = {
  efetivo_por_mes: Array<{ mes: string; total_diarias: number }>
  custo_projeto_negociado: number
  ratio_custo_por_diaria: number
  ratio_custo_por_mes: number
}

type RegressionResponse = {
  regression_available: boolean
  reason: string | null
  message?: string | null
  model_type: string
  r2: number | null
  mae: number | null
  prediction_next_month: number | null
  confidence_interval: [number, number] | null
  observations_available: number
}

type DatasetResponse = {
  rows: Array<Record<string, string | number | null>>
  columns: string[]
  ready_for_regression: boolean
}

type CrossAnalysisDashboardProps = {
  sessionId: string
}

const TABS: Array<{ id: CrossTab; label: string }> = [
  { id: "vinculacao", label: "Vinculacao" },
  { id: "comparacao", label: "Comparacao" },
  { id: "previsao", label: "Previsao" },
  { id: "dataset", label: "Dataset exportavel" },
]

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDecimal(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

export const CrossAnalysisDashboard: React.FC<CrossAnalysisDashboardProps> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState<CrossTab>("vinculacao")
  const [linkage, setLinkage] = useState<LinkageResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [regression, setRegression] = useState<RegressionResponse | null>(null)
  const [dataset, setDataset] = useState<DatasetResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetchApiJson<LinkageResponse>(`/api/cross/${sessionId}/linkage`),
      fetchApiJson<ComparisonResponse>(`/api/cross/${sessionId}/comparison`),
      fetchApiJson<RegressionResponse>(`/api/cross/${sessionId}/regression`),
      fetchApiJson<DatasetResponse>(`/api/cross/${sessionId}/dataset`),
    ])
      .then(([linkagePayload, comparisonPayload, regressionPayload, datasetPayload]) => {
        if (!alive) return
        setLinkage(linkagePayload)
        setComparison(comparisonPayload)
        setRegression(regressionPayload)
        setDataset(datasetPayload)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [sessionId])

  const datasetRows = dataset?.rows ?? []
  const datasetMode = useMemo(() => {
    if (dataset?.columns.includes("boletim")) return "boletim"
    return "arquivo"
  }, [dataset])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-[28px] border border-slate-200 bg-white/85" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[24px] border border-slate-200 bg-white/85" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[28px] border border-slate-200 bg-white/85" />
          <div className="h-80 animate-pulse rounded-[28px] border border-slate-200 bg-white/85" />
        </div>
      </div>
    )
  }

  if (!dataset && !comparison && !linkage) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white/90 px-6 text-center shadow-sm">
        <span className="text-4xl">🔗</span>
        <h3 className="mt-4 text-lg font-semibold text-slate-950">Analise cruzada indisponivel</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Esta sessao ainda nao reuniu dados suficientes de efetivo e medicao para montar uma leitura cruzada confiavel.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              Efetivo + Medicoes
            </span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Analise cruzada com regra semantica mais dura</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Este painel so aparece quando a sessao combina arquivos compativeis. Quando a base ainda nao sustenta regressao confiavel, a resposta fica explicitamente descritiva.
            </p>
          </div>
          <div
            className={`rounded-3xl border px-5 py-4 text-sm ${
              linkage?.linked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {linkage?.linked
              ? `Projetos vinculados: ${linkage.project_code}`
              : "Sem vinculo forte detectado. A comparacao segue apenas como apoio descritivo."}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "vinculacao" && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Custo do projeto", formatCurrency(comparison?.custo_projeto_negociado)],
            ["Custo por diaria", formatCurrency(comparison?.ratio_custo_por_diaria)],
            ["Custo por mes", formatCurrency(comparison?.ratio_custo_por_mes)],
            ["Observacoes", String(regression?.observations_available ?? datasetRows.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "comparacao" && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Evolucao do efetivo</h3>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison?.efetivo_por_mes ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="mes" stroke="#64748B" />
                  <YAxis stroke="#64748B" />
                  <Tooltip />
                  <Bar dataKey="total_diarias" fill="#3B82F6" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Base comparavel</h3>
            <p className="mt-1 text-sm text-slate-500">
              Modo atual: {datasetMode === "boletim" ? "observacao por boletim" : "observacao por arquivo/mes"}.
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datasetRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="mes" stroke="#64748B" />
                  <YAxis stroke="#64748B" />
                  <Tooltip />
                  <Bar dataKey="total_diarias" fill="#93C5FD" />
                  <Line type="monotone" dataKey="custo_projeto_negociado" stroke="#F97316" strokeWidth={3} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "previsao" && (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Previsao e regressao</h3>
          {!regression?.regression_available ? (
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 text-amber-900">
              <p className="font-semibold">Regressao indisponivel por desenho do dataset atual.</p>
              <p className="mt-2 text-sm leading-6">
                {regression?.message || "Ainda nao ha observacoes independentes suficientes para uma regressao robusta."}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Modelo", regression.model_type],
                ["R2", formatDecimal(regression.r2)],
                ["MAE", formatDecimal(regression.mae)],
                ["Proxima previsao", formatCurrency(regression.prediction_next_month)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "dataset" && (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Dataset normalizado</h3>
          <p className="mt-1 text-sm text-slate-500">
            Cada linha mantem identidade suficiente para auditoria externa e regressao futura.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                  {(dataset?.columns ?? []).map((column) => (
                    <th key={column} className="px-3 py-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasetRows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    {(dataset?.columns ?? []).map((column) => (
                      <td key={`${index}-${column}`} className="px-3 py-3 text-slate-700">
                        {String(row[column] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
