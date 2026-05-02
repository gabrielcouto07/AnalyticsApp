import React, { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson } from "../api/analytics"
import { API_BASE_URL } from "../api/client"
import { useSessionStore } from "../store/session"
import { SchemaGuard } from "./SchemaGuard"

type EfetivoTab =
  | "visao-geral"
  | "por-fornecedor"
  | "por-funcao"
  | "evolucao"
  | "presenca"
  | "detalhamento"

type SummaryResponse = {
  obra: string
  total_diarias: number
  fornecedores_ativos: number
  funcoes_distintas: number
  dias_ativos: number
  media_diaria: number
  pico_diario: number
  efetivo_por_mes: Array<{ mes: string; total: number }>
  top_fornecedores: Array<{ fornecedor: string; total: number }>
}

type SupplierRow = {
  fornecedor: string
  total_diarias: number
  meses_ativos: number
  funcoes: string[]
  pct_total: number
}

type FunctionRow = {
  funcao: string
  total_diarias: number
  fornecedores: string[]
  pct_total: number
}

type EvolutionMonth = {
  mes: string
  mes_num: number | null
  total: number
  by_fornecedor: Array<{ fornecedor: string; total: number }>
}

type HeatmapCell = {
  mes: string
  dia: number | null
  data: string | null
  total: number
  tipo: string
}

type DetailRow = {
  mes: string
  dia: number | null
  data: string | null
  fornecedor: string
  funcao: string
  quantidade_efetivo: number | null
  tipo_valor: string
  observacao?: string | null
}

type DetailResponse = {
  items: DetailRow[]
  total: number
  page: number
  per_page: number
}

const TABS: Array<{ id: EfetivoTab; label: string }> = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "por-fornecedor", label: "Por Fornecedor" },
  { id: "por-funcao", label: "Por Função" },
  { id: "evolucao", label: "Evolução Mensal" },
  { id: "presenca", label: "Presença" },
  { id: "detalhamento", label: "Detalhamento" },
]

const CHART_COLORS = ["#3B82F6", "#2563EB", "#60A5FA", "#0EA5E9", "#38BDF8", "#94A3B8"]

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toLocaleString("pt-BR")
}

function formatDecimal(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR")
}

function heatmapColor(cell: { total: number; tipo: string }, maxTotal: number) {
  if (cell.tipo === "erro") return "bg-rose-500/80"
  if (cell.tipo === "vazio" || cell.tipo === "traco" || cell.tipo === "na") return "bg-white"
  if (cell.tipo === "zero") return "bg-slate-200"
  if (maxTotal <= 0) return "bg-emerald-100"

  const ratio = Math.max(0, Math.min(1, cell.total / maxTotal))
  if (ratio >= 0.8) return "bg-emerald-700"
  if (ratio >= 0.6) return "bg-emerald-600"
  if (ratio >= 0.4) return "bg-emerald-500"
  if (ratio >= 0.2) return "bg-emerald-300"
  return "bg-emerald-100"
}

function exportRowsToCsv(rows: DetailRow[]) {
  const header = ["mes", "dia", "data", "fornecedor", "funcao", "quantidade_efetivo", "tipo_valor", "observacao"]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.mes,
        row.dia ?? "",
        row.data ?? "",
        row.fornecedor,
        row.funcao,
        row.quantidade_efetivo ?? "",
        row.tipo_valor,
        row.observacao ?? "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "efetivo_detalhamento.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
    </div>
  )
}

export const EfetivoDashboard: React.FC = () => {
  const sessionId = useSessionStore((state) => state.sessionId)
  const [activeTab, setActiveTab] = useState<EfetivoTab>("visao-geral")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>([])
  const [functionRows, setFunctionRows] = useState<FunctionRow[]>([])
  const [evolutionMonths, setEvolutionMonths] = useState<EvolutionMonth[]>([])
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([])
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [supplierFilter, setSupplierFilter] = useState("")
  const [functionFilter, setFunctionFilter] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<string>("")

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<SummaryResponse>(`/api/efetivo/${sessionId}/summary`),
      fetchApiJson<{ items: SupplierRow[] }>(`/api/efetivo/${sessionId}/by_supplier`),
      fetchApiJson<{ items: FunctionRow[] }>(`/api/efetivo/${sessionId}/by_function`),
      fetchApiJson<{ months: EvolutionMonth[] }>(`/api/efetivo/${sessionId}/monthly_evolution`),
      fetchApiJson<{ cells: HeatmapCell[] }>(`/api/efetivo/${sessionId}/calendar_heatmap`),
    ])
      .then(([summaryPayload, supplierPayload, functionPayload, evolutionPayload, heatmapPayload]) => {
        if (!alive) return
        setSummary(summaryPayload)
        setSupplierRows(supplierPayload.items ?? [])
        setFunctionRows(functionPayload.items ?? [])
        setEvolutionMonths(evolutionPayload.months ?? [])
        setHeatmapCells(heatmapPayload.cells ?? [])
        setSelectedSupplier((current) => current || supplierPayload.items?.[0]?.fornecedor || "")
      })
      .catch(() => {
        if (!alive) return
        setError("Não foi possível carregar o dashboard de efetivo.")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    fetchApiJson<DetailResponse>(`/api/efetivo/${sessionId}/detail?page=${detailPage}&per_page=50`)
      .then((payload) => {
        if (alive) setDetail(payload)
      })
      .catch(() => {
        if (alive) setDetail(null)
      })
    return () => {
      alive = false
    }
  }, [detailPage, sessionId])

  const filteredSuppliers = useMemo(() => {
    const term = supplierFilter.trim().toLowerCase()
    if (!term) return supplierRows
    return supplierRows.filter((item) => item.fornecedor.toLowerCase().includes(term))
  }, [supplierFilter, supplierRows])

  const filteredFunctions = useMemo(() => {
    const term = functionFilter.trim().toLowerCase()
    if (!term) return functionRows
    return functionRows.filter((item) => item.funcao.toLowerCase().includes(term))
  }, [functionFilter, functionRows])

  const supplierBreakdown = useMemo(() => {
    if (!selectedSupplier) return []
    return evolutionMonths.map((month) => {
      const match = month.by_fornecedor.find((item) => item.fornecedor === selectedSupplier)
      return { mes: month.mes, total: match?.total ?? 0 }
    })
  }, [evolutionMonths, selectedSupplier])

  const stackedChartData = useMemo(() => {
    const supplierTotals = new Map<string, number>()
    evolutionMonths.forEach((month) => {
      month.by_fornecedor.forEach((item) => {
        supplierTotals.set(item.fornecedor, (supplierTotals.get(item.fornecedor) ?? 0) + item.total)
      })
    })
    const topSuppliers = [...supplierTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([supplier]) => supplier)

    const rows = evolutionMonths.map((month) => {
      const row: Record<string, string | number> = { mes: month.mes, Outros: 0 }
      month.by_fornecedor.forEach((item) => {
        if (topSuppliers.includes(item.fornecedor)) {
          row[item.fornecedor] = item.total
        } else {
          row.Outros = Number(row.Outros) + item.total
        }
      })
      topSuppliers.forEach((supplier) => {
        if (!(supplier in row)) row[supplier] = 0
      })
      return row
    })
    return { rows, topSuppliers }
  }, [evolutionMonths])

  const normalizedHeatmap = useMemo(() => {
    const priority: Record<string, number> = { erro: 5, numero: 4, zero: 3, traco: 2, na: 1, vazio: 0 }
    const merged = new Map<string, HeatmapCell>()
    heatmapCells.forEach((cell) => {
      const key = `${cell.mes}-${cell.dia ?? "x"}`
      const current = merged.get(key)
      if (!current) {
        merged.set(key, { ...cell })
        return
      }
      const nextTipo =
        (priority[cell.tipo] ?? 0) >= (priority[current.tipo] ?? 0) ? cell.tipo : current.tipo
      merged.set(key, {
        ...current,
        total: current.total + cell.total,
        tipo: nextTipo,
      })
    })
    return [...merged.values()].sort((a, b) => {
      if (a.mes === b.mes) return (a.dia ?? 0) - (b.dia ?? 0)
      return a.mes.localeCompare(b.mes)
    })
  }, [heatmapCells])

  const heatmapMonths = useMemo(() => [...new Set(normalizedHeatmap.map((item) => item.mes))], [normalizedHeatmap])
  const maxHeatValue = useMemo(
    () => normalizedHeatmap.reduce((max, cell) => (cell.total > max ? cell.total : max), 0),
    [normalizedHeatmap],
  )

  if (!sessionId) return null

  const handleExportSession = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/export/${sessionId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "efetivo_export.xlsx"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      console.error("Erro ao exportar efetivo", exportError)
    }
  }

  return (
    <SchemaGuard requires="efetivo">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Efetivo de Obra
              </span>
              {summary?.obra && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {summary.obra}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Leitura diária do efetivo sem ruído</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Veja presença por mês, fornecedores, funções e detalhes de célula sem misturar esse arquivo com outros contextos.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExportSession}
              className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Exportar sessão
            </button>
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
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
            <p className="text-lg font-semibold">Não conseguimos montar este dashboard agora.</p>
            <p className="mt-2 text-sm">Tente reenviar o arquivo ou trocar de sessão.</p>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            {activeTab === "visao-geral" && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  {[
                    ["Total de Diárias", formatDecimal(summary.total_diarias)],
                    ["Fornecedores Ativos", formatNumber(summary.fornecedores_ativos)],
                    ["Funções Distintas", formatNumber(summary.funcoes_distintas)],
                    ["Dias Ativos", formatNumber(summary.dias_ativos)],
                    ["Média Diária", formatDecimal(summary.media_diaria)],
                    ["Pico Diário", formatDecimal(summary.pico_diario)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.4fr,1fr]">
                  <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-950">Efetivo total por mês</h3>
                      <p className="text-sm text-slate-500">Visão rápida dos meses mais intensos da obra.</p>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.efetivo_por_mes}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="mes" stroke="#64748B" />
                          <YAxis stroke="#64748B" />
                          <Tooltip />
                          <Bar dataKey="total" fill="#3B82F6" radius={[12, 12, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-950">Top 5 fornecedores</h3>
                      <p className="text-sm text-slate-500">Quem mais concentrou diárias no período.</p>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.top_fornecedores} layout="vertical" margin={{ left: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis type="number" stroke="#64748B" />
                          <YAxis dataKey="fornecedor" type="category" width={120} stroke="#64748B" />
                          <Tooltip />
                          <Bar dataKey="total" fill="#1D4ED8" radius={[0, 12, 12, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "por-fornecedor" && (
              <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Fornecedores</h3>
                      <p className="text-sm text-slate-500">Clique em uma linha para ver o comportamento mensal.</p>
                    </div>
                    <input
                      value={supplierFilter}
                      onChange={(event) => setSupplierFilter(event.target.value)}
                      placeholder="Filtrar fornecedor"
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-400"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                          <th className="px-3 py-3">Fornecedor</th>
                          <th className="px-3 py-3">Total</th>
                          <th className="px-3 py-3">Meses</th>
                          <th className="px-3 py-3">% do total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSuppliers.map((row) => {
                          const isSelected = row.fornecedor === selectedSupplier
                          return (
                            <tr
                              key={row.fornecedor}
                              className={`cursor-pointer border-b border-slate-100 ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                              onClick={() => setSelectedSupplier(row.fornecedor)}
                            >
                              <td className="px-3 py-3 font-semibold text-slate-900">{row.fornecedor}</td>
                              <td className="px-3 py-3 text-slate-700">{formatDecimal(row.total_diarias)}</td>
                              <td className="px-3 py-3 text-slate-700">{formatNumber(row.meses_ativos)}</td>
                              <td className="px-3 py-3 text-slate-700">{formatPercent(row.pct_total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-950">{selectedSupplier || "Selecione um fornecedor"}</h3>
                    <p className="text-sm text-slate-500">Quebra mensal para facilitar leitura operacional.</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={supplierBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="mes" stroke="#64748B" />
                        <YAxis stroke="#64748B" />
                        <Tooltip />
                        <Bar dataKey="total" fill="#2563EB" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "por-funcao" && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Funções ativas</h3>
                    <p className="text-sm text-slate-500">Leitura simples das funções com maior peso no efetivo.</p>
                  </div>
                  <input
                    value={functionFilter}
                    onChange={(event) => setFunctionFilter(event.target.value)}
                    placeholder="Filtrar função"
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-blue-400"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-3 py-3">Função</th>
                        <th className="px-3 py-3">Total</th>
                        <th className="px-3 py-3">Fornecedores</th>
                        <th className="px-3 py-3">% do total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFunctions.map((row) => (
                        <tr key={row.funcao} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-slate-900">{row.funcao}</td>
                          <td className="px-3 py-3 text-slate-700">{formatDecimal(row.total_diarias)}</td>
                          <td className="px-3 py-3 text-slate-700">{formatNumber(row.fornecedores.length)}</td>
                          <td className="px-3 py-3 text-slate-700">{formatPercent(row.pct_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "evolucao" && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-950">Evolução mensal por fornecedor</h3>
                  <p className="text-sm text-slate-500">Top 5 fornecedores em destaque e o restante consolidado em “Outros”.</p>
                </div>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stackedChartData.rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="mes" stroke="#64748B" />
                      <YAxis stroke="#64748B" />
                      <Tooltip />
                      {stackedChartData.topSuppliers.map((supplier, index) => (
                        <Area
                          key={supplier}
                          type="monotone"
                          dataKey={supplier}
                          stackId="1"
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          fillOpacity={0.35}
                        />
                      ))}
                      <Area type="monotone" dataKey="Outros" stackId="1" stroke="#94A3B8" fill="#CBD5E1" fillOpacity={0.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === "presenca" && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-slate-950">Calendário de presença</h3>
                  <p className="text-sm text-slate-500">Verde mais forte indica maior volume de diárias. Cinza é zero. Branco representa vazio ou não aplicável.</p>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[980px] space-y-3">
                    <div className="grid grid-cols-[140px_repeat(31,minmax(0,1fr))] gap-2 text-center text-xs font-semibold text-slate-500">
                      <div className="text-left">Mês</div>
                      {Array.from({ length: 31 }).map((_, index) => (
                        <div key={index + 1}>{index + 1}</div>
                      ))}
                    </div>
                    {heatmapMonths.map((month) => (
                      <div key={month} className="grid grid-cols-[140px_repeat(31,minmax(0,1fr))] gap-2">
                        <div className="flex items-center text-sm font-semibold text-slate-700">{month}</div>
                        {Array.from({ length: 31 }).map((_, index) => {
                          const day = index + 1
                          const cell = normalizedHeatmap.find((item) => item.mes === month && item.dia === day) ?? {
                            mes: month,
                            dia: day,
                            data: null,
                            total: 0,
                            tipo: "vazio",
                          }
                          return (
                            <div
                              key={`${month}-${day}`}
                              title={`${month} dia ${day}: ${formatDecimal(cell.total)} (${cell.tipo})`}
                              className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold ${heatmapColor(cell, maxHeatValue)} ${
                                cell.tipo === "numero" && cell.total > maxHeatValue * 0.55 ? "text-white" : "text-slate-700"
                              }`}
                            >
                              {cell.tipo === "erro" ? "!" : cell.total > 0 ? formatDecimal(cell.total) : ""}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "detalhamento" && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Detalhamento diário</h3>
                    <p className="text-sm text-slate-500">Valores especiais como traço, vazio e erro ficam visíveis sem quebrar a leitura.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportRowsToCsv(detail?.items ?? [])}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Exportar página em CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-3 py-3">Mês</th>
                        <th className="px-3 py-3">Dia</th>
                        <th className="px-3 py-3">Data</th>
                        <th className="px-3 py-3">Fornecedor</th>
                        <th className="px-3 py-3">Função</th>
                        <th className="px-3 py-3">Qtd</th>
                        <th className="px-3 py-3">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.items ?? []).map((row, index) => (
                        <tr key={`${row.data}-${row.fornecedor}-${row.funcao}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 text-slate-700">{row.mes}</td>
                          <td className="px-3 py-3 text-slate-700">{row.dia ?? "-"}</td>
                          <td className="px-3 py-3 text-slate-700">{formatDate(row.data)}</td>
                          <td className="px-3 py-3 font-medium text-slate-900">{row.fornecedor}</td>
                          <td className="px-3 py-3 text-slate-700">{row.funcao}</td>
                          <td className="px-3 py-3 text-slate-700">{formatDecimal(row.quantidade_efetivo)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                row.tipo_valor === "numero"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : row.tipo_valor === "erro"
                                    ? "bg-rose-100 text-rose-700"
                                    : row.tipo_valor === "zero"
                                      ? "bg-slate-200 text-slate-700"
                                      : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {row.tipo_valor}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <p>
                    Página {detail?.page ?? detailPage} de{" "}
                    {detail?.total ? Math.max(1, Math.ceil(detail.total / (detail.per_page || 50))) : 1}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailPage((current) => Math.max(1, current - 1))}
                      disabled={detailPage === 1}
                      className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDetailPage((current) => {
                          const totalPages = detail?.total ? Math.max(1, Math.ceil(detail.total / (detail.per_page || 50))) : 1
                          return Math.min(totalPages, current + 1)
                        })
                      }
                      disabled={Boolean(detail && detail.total <= detailPage * (detail.per_page || 50))}
                      className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SchemaGuard>
  )
}
