import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { DataQualityReport } from "../api/analytics"
import { fetchApiJson } from "../api/analytics"

type MedicaoTab = "proposta" | "itens" | "qualidade"

type BoletimResumo = {
  sheet_name: string
  bm_numero?: string | number | null
  periodo_medicao?: string | null
  vencimento?: string | null
  fornecedor?: string | null
  obra?: string | null
  total: number
  valor_total_boletim: number
  total_itens: number
  num_itens: number
  mes_ref?: string | null
}

type MedicaoSummaryResponse = {
  metadata: {
    obra?: string | null
    assunto?: string | null
    fornecedor?: string | null
    data?: string | null
    contato?: string | null
    telefone?: string | null
    email?: string | null
    endereco?: string | null
    periodo_medicao?: string | null
    vencimento?: string | null
    num_boletins?: number | null
    tipo_documento?: string | null
    recommended_view?: string | null
  }
  boletins?: BoletimResumo[]
  custo_inicial?: number
  custo_negociado?: number
  diferenca?: number
  diferenca_valor?: number
  variacao_percentual?: number
  classificacao_variacao?: "desconto" | "acrescimo" | "neutro"
  desconto_pct?: number | null
  num_itens?: number
  total_itens?: number
  num_boletins?: number
  quantidade_boletins?: number
  valor_total_arquivo?: number
  media_por_boletim?: number
  maior_boletim?: BoletimResumo | null
  menor_boletim?: BoletimResumo | null
  tipo_documento?: string
}

type MedicaoItem = {
  item: number | string
  descricao_servico: string
  quantidade: number
  unidade: string
  valor_inicial: number | null
  valor_negociado: number | null
  total: number
  tipo_celula: string
  observacao?: string | null
  sheet_name?: string | null
  bm_numero?: string | number | null
  periodo_medicao?: string | null
}

type MedicaoItemsResponse = {
  items: MedicaoItem[]
}

type MedicaoDashboardProps = {
  sessionId: string
}

const TABS: Array<{ id: MedicaoTab; label: string }> = [
  { id: "proposta", label: "Proposta / Boletins" },
  { id: "itens", label: "Itens" },
  { id: "qualidade", label: "Qualidade" },
]

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatPercentRatio(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("pt-BR")
}

function tooltipCurrency(value: string | number | readonly (string | number)[] | null | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value
  const numeric = typeof normalized === "number" ? normalized : Number(normalized)
  return formatCurrency(Number.isFinite(numeric) ? numeric : null)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white/85" />
    </div>
  )
}

function getVariationPresentation(summary: MedicaoSummaryResponse | null) {
  const variationType = summary?.classificacao_variacao ?? "neutro"
  if (variationType === "desconto") {
    return {
      label: "Desconto",
      value: formatCurrency(Math.abs(summary?.diferenca_valor ?? 0)),
      percent: formatPercentRatio(summary?.desconto_pct ?? null),
      className: "border-emerald-200 bg-emerald-50/80",
      textClassName: "text-emerald-900",
    }
  }
  if (variationType === "acrescimo") {
    return {
      label: "Acrescimo",
      value: formatCurrency(summary?.diferenca_valor ?? 0),
      percent: formatPercentRatio(summary?.variacao_percentual ?? null),
      className: "border-orange-200 bg-orange-50/80",
      textClassName: "text-orange-900",
    }
  }
  return {
    label: "Sem variacao",
    value: formatCurrency(0),
    percent: "0%",
    className: "border-slate-200 bg-slate-50",
    textClassName: "text-slate-900",
  }
}

export const MedicaoDashboard: React.FC<MedicaoDashboardProps> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState<MedicaoTab>("proposta")
  const [summary, setSummary] = useState<MedicaoSummaryResponse | null>(null)
  const [items, setItems] = useState<MedicaoItem[]>([])
  const [quality, setQuality] = useState<DataQualityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sheetFilter, setSheetFilter] = useState("todos")
  const [selectedBoletim, setSelectedBoletim] = useState("consolidado")

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetchApiJson<MedicaoSummaryResponse>(`/api/medicao/${sessionId}/summary`),
      fetchApiJson<MedicaoItemsResponse>(`/api/medicao/${sessionId}/items`),
      fetchApiJson<DataQualityReport>(`/api/medicao/${sessionId}/quality`),
    ])
      .then(([summaryPayload, itemsPayload, qualityPayload]) => {
        if (!alive) return
        setSummary(summaryPayload)
        setItems(itemsPayload.items ?? [])
        setQuality(qualityPayload)
        setSelectedBoletim("consolidado")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [sessionId])

  const boletins = useMemo(() => summary?.boletins ?? [], [summary?.boletins])
  const isBoletimWorkbook = (summary?.metadata?.tipo_documento ?? summary?.tipo_documento) === "boletim_medicao"
  const variation = getVariationPresentation(summary)

  const boletimOptions = useMemo(
    () => ["consolidado", ...boletins.map((boletim) => boletim.sheet_name)],
    [boletins],
  )

  const selectedBoletimData = useMemo(
    () => boletins.find((boletim) => boletim.sheet_name === selectedBoletim) ?? null,
    [boletins, selectedBoletim],
  )

  const availableSheets = useMemo(
    () => ["todos", ...Array.from(new Set(items.map((item) => item.sheet_name).filter(Boolean) as string[]))],
    [items],
  )

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const selectedSheet = selectedBoletim === "consolidado" ? "todos" : selectedBoletim
      const matchesSheet =
        (sheetFilter === "todos" || item.sheet_name === sheetFilter) &&
        (selectedSheet === "todos" || item.sheet_name === selectedSheet)
      const matchesSearch =
        !term ||
        item.descricao_servico.toLowerCase().includes(term) ||
        String(item.item).toLowerCase().includes(term) ||
        String(item.bm_numero ?? "").toLowerCase().includes(term)
      return matchesSheet && matchesSearch
    })
  }, [items, search, selectedBoletim, sheetFilter])

  const chartData = useMemo(
    () =>
      boletins.map((boletim) => ({
        nome: boletim.sheet_name,
        total: boletim.valor_total_boletim,
      })),
    [boletins],
  )

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                {isBoletimWorkbook ? "Boletim de Medicao" : "Medicoes / MP"}
              </span>
              {summary?.quantidade_boletins ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {summary.quantidade_boletins} boletins / abas
                </span>
              ) : null}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{summary?.metadata?.obra || "Obra nao identificada"}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {summary?.metadata?.assunto || "Leitura consolidada da proposta, medicao ou boletins deste fornecedor."}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Fornecedor:</span> {summary?.metadata?.fornecedor || "-"}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-900">Data:</span> {formatDate(summary?.metadata?.data)}
            </p>
            {summary?.metadata?.periodo_medicao && (
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Periodo:</span> {summary.metadata.periodo_medicao}
              </p>
            )}
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
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "proposta" && (
        <div className="space-y-5">
          {isBoletimWorkbook && boletimOptions.length > 1 && (
            <div className="rounded-[24px] border border-violet-200 bg-violet-50/70 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-900">Este arquivo possui varios boletins.</p>
                  <p className="text-sm text-violet-800/80">
                    A visao consolidada continua disponivel, mas cada aba MED pode ser analisada separadamente.
                  </p>
                </div>
                <select
                  value={selectedBoletim}
                  onChange={(event) => setSelectedBoletim(event.target.value)}
                  className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-violet-400"
                >
                  {boletimOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "consolidado" ? "Visao consolidada" : option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Custo Inicial", value: formatCurrency(summary?.custo_inicial), className: "border-slate-200 bg-white/90", textClassName: "text-slate-950" },
              { label: "Custo Negociado / Medido", value: formatCurrency(summary?.custo_negociado), className: "border-slate-200 bg-white/90", textClassName: "text-slate-950" },
              { label: variation.label, value: variation.value, className: variation.className, textClassName: variation.textClassName },
              { label: "Variacao %", value: variation.percent, className: variation.className, textClassName: variation.textClassName },
              {
                label: isBoletimWorkbook ? "Boletins" : "Itens",
                value: String(isBoletimWorkbook ? (summary?.quantidade_boletins ?? 0) : (summary?.total_itens ?? summary?.num_itens ?? 0)),
                className: "border-slate-200 bg-white/90",
                textClassName: "text-slate-950",
              },
            ].map((card) => (
              <div key={card.label} className={`rounded-[24px] border p-5 shadow-sm ${card.className}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                <p className={`mt-3 text-3xl font-bold ${card.textClassName}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Metadados principais</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  ["Obra", summary?.metadata?.obra],
                  ["Assunto", summary?.metadata?.assunto],
                  ["Fornecedor", summary?.metadata?.fornecedor],
                  ["Contato", summary?.metadata?.contato],
                  ["Telefone", summary?.metadata?.telefone],
                  ["E-mail", summary?.metadata?.email],
                  ["Endereco", summary?.metadata?.endereco],
                  ["Vencimento", summary?.metadata?.vencimento],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{value || "-"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">
                {isBoletimWorkbook ? "Valor por boletim" : "Resumo do documento"}
              </h3>
              {chartData.length > 0 ? (
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="nome" stroke="#64748B" />
                      <YAxis stroke="#64748B" />
                      <Tooltip formatter={(value) => tooltipCurrency(value)} />
                      <Bar dataKey="total" fill="#A855F7" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Este arquivo traz uma proposta unica, entao a leitura principal esta nos KPIs e nos itens abaixo.
                </p>
              )}
            </div>
          </div>

          {isBoletimWorkbook && (
            <div className="grid gap-5 xl:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Valor total do arquivo</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(summary?.valor_total_arquivo)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Media por boletim</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(summary?.media_por_boletim)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Maior boletim</p>
                <p className="mt-3 text-lg font-bold text-slate-950">{summary?.maior_boletim?.sheet_name || "-"}</p>
                <p className="mt-1 text-sm text-slate-600">{formatCurrency(summary?.maior_boletim?.valor_total_boletim)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {selectedBoletimData ? "Boletim selecionado" : "Menor boletim"}
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  {(selectedBoletimData?.sheet_name ?? summary?.menor_boletim?.sheet_name) || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatCurrency(selectedBoletimData?.valor_total_boletim ?? summary?.menor_boletim?.valor_total_boletim)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "itens" && (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Itens normalizados</h3>
              <p className="text-sm text-slate-500">Funciona tanto para propostas MP quanto para boletins MED xx.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <select
                value={sheetFilter}
                onChange={(event) => setSheetFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-violet-400"
              >
                {availableSheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet === "todos" ? "Todas as abas" : sheet}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrar item, descricao ou boletim"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-violet-400"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-3 py-3">Aba</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Descricao</th>
                  <th className="px-3 py-3">Qtd</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3">Valor inicial</th>
                  <th className="px-3 py-3">Valor negociado</th>
                  <th className="px-3 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const hasNegotiation =
                    item.valor_negociado !== null &&
                    item.valor_inicial !== null &&
                    item.valor_negociado !== item.valor_inicial
                  const rowClassName =
                    item.tipo_celula === "erro"
                      ? "bg-rose-50/70"
                      : hasNegotiation
                        ? "bg-violet-50/60"
                        : "hover:bg-slate-50"
                  return (
                    <tr key={`${item.sheet_name}-${item.item}-${index}`} className={`border-b border-slate-100 ${rowClassName}`}>
                      <td className="px-3 py-3 text-slate-700">{item.sheet_name || "-"}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{item.item}</td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="space-y-1">
                          <p>{item.descricao_servico}</p>
                          {item.tipo_celula === "erro" && (
                            <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              Erro de celula
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{item.quantidade.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-3 text-slate-700">{item.unidade}</td>
                      <td className="px-3 py-3 text-slate-700">{formatCurrency(item.valor_inicial)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatCurrency(item.valor_negociado)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "qualidade" && quality && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Erros", quality.error_cells],
              ["Vazios", quality.empty_cells],
              ["Tracos", quality.dash_cells],
              ["Formulas", quality.formula_cells],
              ["Fracionarios", quality.fractional_values],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Avisos do parser</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {(quality.schema_warnings.length > 0 ? quality.schema_warnings : ["Nenhum aviso estrutural relevante."]).map((warning) => (
                  <div key={warning} className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
                    {warning}
                  </div>
                ))}
                {(quality.normalization_notes.length > 0 ? quality.normalization_notes : ["Nenhuma nota extra de normalizacao."]).map((note) => (
                  <div key={note} className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Celulas problematicas</h3>
              <div className="mt-4 space-y-3">
                {quality.cell_errors_detail.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhuma celula com erro foi registrada.</p>
                )}
                {quality.cell_errors_detail.slice(0, 20).map((cell, index) => (
                  <div key={`${cell.sheet}-${cell.row}-${cell.col}-${index}`} className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    <span className="font-semibold">{cell.sheet}</span> • linha {cell.row} • coluna {cell.col} • valor {cell.raw_value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
