"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson } from "../api/analytics"
import { fmtMoeda, fmtNum, fmtPct } from "../lib/formatters"
import { useSessionStore } from "../store/session"

type Method = "exponential_smoothing" | "linear" | "moving_average"
type TabId = "resumo" | "efetivo" | "custos" | "configurar"

interface AnalyticsProps {
  sessionId: string
}

interface HistoricalPoint {
  label: string
  value: number
}

interface ForecastPoint {
  label: string
  value: number
  lower_bound: number
  upper_bound: number
}

interface ForecastSeries {
  historical: HistoricalPoint[]
  forecast: ForecastPoint[]
  trend: "crescente" | "decrescente" | "estável" | string
  variacao_pct_periodo: number
  r_squared?: number | null
}

interface SummaryHighlight {
  label: string
  current: number
  forecast: number
  variacao_pct: number
  trend: string
}

interface SummaryResponse {
  available_forecasts: string[]
  next_period_label: string
  highlights: SummaryHighlight[]
}

interface EfetivoForecastResponse {
  headcount_geral: ForecastSeries
  por_cargo: Record<string, ForecastSeries>
  alertas: string[]
}

interface CustosForecastResponse {
  total: ForecastSeries
  por_natureza: Record<string, ForecastSeries>
  alertas: string[]
}

interface ChartPoint {
  label: string
  historical: number | null
  forecast: number | null
  lower_bound: number | null
  upper_bound: number | null
}

const METHOD_LABELS: Record<Method, string> = {
  exponential_smoothing: "Exponencial",
  linear: "Linear",
  moving_average: "Média móvel",
}

const COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#f87171", "#14b8a6"]

function buildLineData(series: ForecastSeries | null): ChartPoint[] {
  if (!series) return []
  const historical = series.historical.map((point) => ({
    label: point.label,
    historical: point.value,
    forecast: null,
    lower_bound: null,
    upper_bound: null,
  }))
  const lastHistorical = series.historical.at(-1)
  const forecast = series.forecast.map((point, index) => ({
    label: point.label,
    historical: null,
    forecast: point.value,
    lower_bound: point.lower_bound,
    upper_bound: point.upper_bound,
    ...(index === 0 && lastHistorical
      ? { historical: lastHistorical.value }
      : {}),
  }))
  return [...historical, ...forecast]
}

function buildStackedData(seriesByKey: Record<string, ForecastSeries>): Array<Record<string, string | number>> {
  const rows = new Map<string, Record<string, string | number>>()
  Object.entries(seriesByKey).forEach(([key, series]) => {
    series.historical.forEach((point) => {
      const row = rows.get(point.label) ?? { label: point.label }
      row[key] = point.value
      rows.set(point.label, row)
    })
    series.forecast.forEach((point) => {
      const label = `${point.label} prev.`
      const row = rows.get(label) ?? { label }
      row[key] = point.value
      rows.set(label, row)
    })
  })
  return Array.from(rows.values())
}

function trendBadgeClasses(highlight: SummaryHighlight, schemaTypes: string[]) {
  const isCost = highlight.label.toLowerCase().includes("custo") || schemaTypes.includes("custos")
  if (Math.abs(highlight.variacao_pct) <= 2) return "bg-slate-700 text-slate-200"
  if (isCost && highlight.variacao_pct > 0) return "bg-red-500/15 text-red-300"
  if (!isCost && highlight.variacao_pct > 0) return "bg-emerald-500/15 text-emerald-300"
  return "bg-slate-500/15 text-slate-300"
}

function trendIcon(value: number) {
  if (value > 2) return "↑"
  if (value < -2) return "↓"
  return "→"
}

function KpiSkeleton() {
  return <div className="h-24 w-full animate-pulse rounded-lg bg-gray-700" />
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/70 text-center">
      <span className="mb-4 text-5xl">📂</span>
      <h3 className="mb-2 text-lg font-semibold text-gray-200">{title}</h3>
      <p className="max-w-xs text-sm text-gray-400">{message}</p>
    </div>
  )
}

function AlertList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
          {item}
        </div>
      ))}
    </div>
  )
}

function ForecastLineChart({ series, valueLabel }: { series: ForecastSeries | null; valueLabel: string }) {
  const data = useMemo(() => buildLineData(series), [series])
  if (!series || data.length === 0) {
    return <EmptyPanel title="Sem previsão" message="Ainda não há pontos suficientes para montar a série de tendência." />
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value: number) => fmtNum(value)} />
          <Tooltip
            contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 8, color: "#f8fafc" }}
            formatter={(value) => [typeof value === "number" ? fmtNum(value) : String(value ?? "—"), valueLabel]}
          />
          <Area type="monotone" dataKey="upper_bound" stroke="transparent" fill="#38bdf8" fillOpacity={0.15} />
          <Area type="monotone" dataKey="lower_bound" stroke="transparent" fill="#020617" fillOpacity={0.8} />
          <Line type="monotone" dataKey="historical" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} name="Histórico" />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#38bdf8"
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ r: 4 }}
            name="Previsão"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TendenciasDashboard({ sessionId }: AnalyticsProps) {
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const [activeTab, setActiveTab] = useState<TabId>("resumo")
  const [method, setMethod] = useState<Method>("exponential_smoothing")
  const [draftMethod, setDraftMethod] = useState<Method>("exponential_smoothing")
  const [periods, setPeriods] = useState(3)
  const [draftPeriods, setDraftPeriods] = useState(3)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [efetivo, setEfetivo] = useState<EfetivoForecastResponse | null>(null)
  const [custos, setCustos] = useState<CustosForecastResponse | null>(null)
  const [selectedEfetivo, setSelectedEfetivo] = useState("Geral")
  const [selectedCustos, setSelectedCustos] = useState("Total")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canForecastEfetivo = schemaTypes.includes("efetivo")
  const canForecastCustos = schemaTypes.includes("custos")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    const query = `periods=${periods}&method=${method}`
    Promise.all([
      fetchApiJson<SummaryResponse>(`/api/forecast/${sessionId}/summary`),
      canForecastEfetivo
        ? fetchApiJson<EfetivoForecastResponse>(`/api/forecast/${sessionId}/efetivo?${query}`).catch(() => null)
        : Promise.resolve(null),
      canForecastCustos
        ? fetchApiJson<CustosForecastResponse>(`/api/forecast/${sessionId}/custos?${query}`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([nextSummary, nextEfetivo, nextCustos]) => {
        if (!active) return
        setSummary(nextSummary)
        setEfetivo(nextEfetivo)
        setCustos(nextCustos)
        setSelectedEfetivo("Geral")
        setSelectedCustos("Total")
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar previsões.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [canForecastCustos, canForecastEfetivo, method, periods, sessionId])

  const tabs = useMemo<Array<{ id: TabId; label: string }>>(
    () => [
      { id: "resumo", label: "Resumo" },
      ...(canForecastEfetivo ? [{ id: "efetivo" as TabId, label: "Efetivo" }] : []),
      ...(canForecastCustos ? [{ id: "custos" as TabId, label: "Custos" }] : []),
      { id: "configurar", label: "Configurar" },
    ],
    [canForecastCustos, canForecastEfetivo],
  )

  const efetivoOptions = useMemo(() => ["Geral", ...Object.keys(efetivo?.por_cargo ?? {})], [efetivo])
  const custosOptions = useMemo(() => ["Total", ...Object.keys(custos?.por_natureza ?? {})], [custos])
  const activeEfetivoSeries = selectedEfetivo === "Geral" ? efetivo?.headcount_geral ?? null : efetivo?.por_cargo[selectedEfetivo] ?? null
  const activeCustosSeries = selectedCustos === "Total" ? custos?.total ?? null : custos?.por_natureza[selectedCustos] ?? null
  const stackedCustosData = useMemo(() => buildStackedData(custos?.por_natureza ?? {}), [custos])
  const naturezaKeys = useMemo(() => Object.keys(custos?.por_natureza ?? {}), [custos])

  if (loading) {
    return (
      <div className="space-y-5 text-slate-100">
        <div>
          <h2 className="text-2xl font-bold">Tendências & Previsão</h2>
          <p className="mt-1 text-sm text-slate-400">Motor de previsão por schema detectado.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <KpiSkeleton key={index} />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg bg-gray-700" />
      </div>
    )
  }

  if (error) {
    return <EmptyPanel title="Erro ao carregar dados" message={error} />
  }

  return (
    <div className="space-y-5 text-slate-100">
      <div>
        <h2 className="text-2xl font-bold">Tendências & Previsão</h2>
        <p className="mt-1 text-sm text-slate-400">
          Próximo período analisado: <span className="font-semibold text-slate-200">{summary?.next_period_label ?? "—"}</span>
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 pb-3 text-sm font-semibold ${
              activeTab === tab.id
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumo" && (
        <div className="space-y-4">
          {(summary?.highlights ?? []).length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {summary?.highlights.map((highlight) => (
                <div key={highlight.label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold uppercase text-slate-400">{highlight.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${trendBadgeClasses(highlight, schemaTypes)}`}>
                      {trendIcon(highlight.variacao_pct)} {highlight.trend}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Atual</p>
                      <p className="mt-1 text-xl font-bold">{highlight.label.includes("Custo") ? fmtMoeda(highlight.current) : fmtNum(highlight.current)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Previsto</p>
                      <p className="mt-1 text-xl font-bold text-emerald-300">
                        {highlight.label.includes("Custo") ? fmtMoeda(highlight.forecast) : fmtNum(highlight.forecast)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-300">{fmtPct(highlight.variacao_pct)} vs. período atual</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Sem previsões disponíveis" message="Faça upload de um arquivo de Efetivo ou Custos com histórico suficiente." />
          )}
        </div>
      )}

      {activeTab === "efetivo" && (
        <div className="space-y-4">
          <AlertList items={efetivo?.alertas ?? []} />
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <label className="flex flex-col gap-2 text-xs font-bold uppercase text-slate-400">
              Série
              <select
                value={selectedEfetivo}
                onChange={(event) => setSelectedEfetivo(event.target.value)}
                className="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-slate-100"
              >
                {efetivoOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ForecastLineChart series={activeEfetivoSeries} valueLabel="Headcount" />
        </div>
      )}

      {activeTab === "custos" && (
        <div className="space-y-4">
          <AlertList items={custos?.alertas ?? []} />
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <label className="flex flex-col gap-2 text-xs font-bold uppercase text-slate-400">
              Natureza
              <select
                value={selectedCustos}
                onChange={(event) => setSelectedCustos(event.target.value)}
                className="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-slate-100"
              >
                {custosOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ForecastLineChart series={activeCustosSeries} valueLabel="Valor" />
          {stackedCustosData.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-200">Composição por natureza</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stackedCustosData}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value: number) => fmtMoeda(value)} />
                  <Tooltip
                    contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 8, color: "#f8fafc" }}
                    formatter={(value) => [typeof value === "number" ? fmtMoeda(value) : String(value ?? "—"), "Valor"]}
                  />
                  <Legend />
                  {naturezaKeys.map((key, index) => (
                    <Bar key={key} dataKey={key} stackId="natureza" fill={COLORS[index % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === "configurar" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-bold uppercase text-slate-400">
              Método
              <select
                value={draftMethod}
                onChange={(event) => setDraftMethod(event.target.value as Method)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-slate-100"
              >
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-bold uppercase text-slate-400">
              Períodos futuros: {draftPeriods}
              <input
                type="range"
                min={1}
                max={12}
                value={draftPeriods}
                onChange={(event) => setDraftPeriods(Number(event.target.value))}
                className="accent-emerald-400"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              setMethod(draftMethod)
              setPeriods(draftPeriods)
              setActiveTab("resumo")
            }}
            className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Recalcular
          </button>
        </div>
      )}
    </div>
  )
}
