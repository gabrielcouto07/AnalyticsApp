"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson } from "../api/analytics"
import { formatBRL, formatDate as formatDateValue, formatInt, formatPct } from "../lib/formatters"
import { SchemaGuard } from "./SchemaGuard"

type TabId = "visao-geral" | "nfs" | "consolidado" | "resumo-forecast"
type GenericRow = Record<string, unknown>

type ExecutiveSummary = {
  total_budget: number
  total_realizado: number
  saldo: number
  pct_consumido: number
  total_nfs: number
  fornecedores_ativos: number
  meses_cobertos: number
  data_inicio: string | null
  data_fim: string | null
  risk_level: "baixo" | "medio" | "alto"
  quality_score: number
}

type BurnRateItem = {
  mes: string
  mes_nome: string
  valor_nfs: number
  valor_acumulado: number
  orcamento_acumulado: number
  saldo_mes: number
  by_natureza?: Array<{ natureza: string; valor: number }>
}

type SupplierConcentration = {
  top_10: Array<{ fornecedor: string; valor_total: number; pct_total: number; count_nfs: number }>
  herfindahl_index: number
  risk_level: "baixo" | "medio" | "alto"
}

type ForecastResponse = {
  projected_final_cost: number
  projected_monthly: Array<{
    mes_offset: number
    valor_previsto: number
    lower_bound: number
    upper_bound: number
    projected_cumulative: number
  }>
  overrun_probability: number
  estimated_completion_month: string | null
  confidence_interval_90: [number, number]
  method: string
  data_points_used: number
  mode?: string
}

type OverdueItem = {
  fornecedor: string
  nf: string
  valor: number
  data_vencimento: string | null
  days_overdue: number
  natureza: string
}

type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

type SupplierRankingItem = {
  fornecedor: string
  valor: number
  participacao: number
  count: number
}

const BRAND_GREEN = "#0b4f3a"
const BRAND_GREEN_DARK = "#08382a"
const ACCENT_TEAL = "#00b4d8"
const ACCENT_BLUE = "#4f8ef7"
const ACCENT_AMBER = "#f5a623"
const ACCENT_RED = "#ef4444"
const ACCENT_PURPLE = "#a78bfa"
const ACCENT_GREEN = "#34c97e"
const SERIES_COLORS = ["#4f8ef7", "#34c97e", "#f5a623", "#a78bfa", "#ef4444", "#06b6d4", "#f97316", "#ec4899"]
const PANEL: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.10)",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 12px rgba(11,79,58,0.07)",
  fontFamily: "'Inter', system-ui, sans-serif",
}
const DARK_CARD: React.CSSProperties = {
  background: "rgba(15,23,42,0.82)",
  borderRadius: 12,
  border: "1px solid rgba(79,142,247,0.13)",
  padding: "16px 20px",
  fontFamily: "'Inter', system-ui, sans-serif",
}

const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "nfs", label: "NFs" },
  { id: "consolidado", label: "Consolidado" },
  { id: "resumo-forecast", label: "Resumo / Forecast" },
]

const PAGE_SIZE = 50
const SITUACAO_OPTIONS = ["Todas", "A PAGAR", "PAGO", "VENCIDO"]

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value !== "string") {
    return 0
  }
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateValue(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatCurrency(value: number) {
  return formatBRL(value)
}

function formatCompactCurrency(value: number) {
  return formatBRL(value)
}

function formatDate(value: unknown) {
  const parsed = parseDateValue(value)
  return parsed ? formatDateValue(parsed) : "-"
}

function getValue(row: GenericRow, key: string) {
  return row[key]
}

function resolveSituation(rawSituacao: unknown, rawDate: unknown) {
  const situacao = normalizeText(rawSituacao)
  if (situacao.includes("pago")) return "PAGO"
  if (situacao.includes("venc")) return "VENCIDO"
  const dueDate = parseDateValue(rawDate)
  if (dueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    if (dueDate < today) return "VENCIDO"
  }
  return "A PAGAR"
}

function sortRows(rows: GenericRow[], key: string, direction: "asc" | "desc", isDate = false, isNumeric = false) {
  return [...rows].sort((left, right) => {
    const leftValue = getValue(left, key)
    const rightValue = getValue(right, key)
    let comparison = 0
    if (isNumeric) {
      comparison = parseNumber(leftValue) - parseNumber(rightValue)
    } else if (isDate) {
      comparison = (parseDateValue(leftValue)?.getTime() ?? 0) - (parseDateValue(rightValue)?.getTime() ?? 0)
    } else {
      comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      })
    }
    return direction === "asc" ? comparison : -comparison
  })
}

function paginate<T>(rows: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return {
    page: safePage,
    totalPages,
    start,
    end: Math.min(start + PAGE_SIZE, rows.length),
    rows: rows.slice(start, start + PAGE_SIZE),
  }
}

type TooltipEntry = { color?: string; name?: string; value?: number | string }

function CustomTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(11,79,58,0.15)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{label}</p>
      {payload.map((entry) => (
        <div
          key={`${entry.name}-${entry.value}`}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569", marginTop: 4 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: entry.color ?? ACCENT_BLUE,
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 600 }}>{entry.name}</span>
          <span style={{ marginLeft: "auto", color: "#0f172a", fontWeight: 700 }}>
            {typeof entry.value === "number" ? formatCurrency(entry.value) : String(entry.value ?? "-")}
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: string
  title: string
  message: string
}) {
  return (
    <div
      style={{
        ...PANEL,
        minHeight: 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#64748b",
      }}
    >
      <span style={{ fontSize: 42, lineHeight: 1, marginBottom: 14 }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
      <p style={{ margin: "10px 0 0", maxWidth: 360, fontSize: 13, lineHeight: 1.6 }}>{message}</p>
    </div>
  )
}

function PanelSkeleton({ height = 220, dark = false }: { height?: number; dark?: boolean }) {
  return (
    <div
      style={{
        ...(dark ? DARK_CARD : PANEL),
        height,
        background: dark
          ? "linear-gradient(90deg, rgba(30,41,59,0.72), rgba(51,65,85,0.85), rgba(30,41,59,0.72))"
          : "linear-gradient(90deg, rgba(226,232,240,0.9), rgba(241,245,249,0.98), rgba(226,232,240,0.9))",
        backgroundSize: "200% 100%",
        animation: "custos-wave 1.4s ease infinite",
      }}
    />
  )
}

function Pagination({
  page,
  totalPages,
  start,
  end,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  start: number
  end: number
  total: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12 }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>
        Exibindo {formatInt(start + 1)}-{formatInt(end)} de {formatInt(total)}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.max(1, page - 1))}>
          Anterior
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          Próxima
        </button>
      </div>
    </div>
  )
}

export const CustosDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState<TabId>("visao-geral")
  const [hasFetchedTab, setHasFetchedTab] = useState<Record<TabId, boolean>>({
    "visao-geral": false,
    nfs: false,
    consolidado: false,
    "resumo-forecast": false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nfsRows, setNfsRows] = useState<GenericRow[]>([])
  const [consolidadoRows, setConsolidadoRows] = useState<GenericRow[]>([])
  const [resumoRows, setResumoRows] = useState<GenericRow[]>([])
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null)
  const [burnRate, setBurnRate] = useState<BurnRateItem[]>([])
  const [supplierConcentration, setSupplierConcentration] = useState<SupplierConcentration | null>(null)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [overdueRows, setOverdueRows] = useState<OverdueItem[]>([])
  const [selectedNaturezas, setSelectedNaturezas] = useState<string[]>([])
  const [selectedConsolidadoNaturezas, setSelectedConsolidadoNaturezas] = useState<string[]>([])
  const [selectedSituacao, setSelectedSituacao] = useState("Todas")
  const [fornecedorSearch, setFornecedorSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [consolidadoDateFrom, setConsolidadoDateFrom] = useState("")
  const [consolidadoDateTo, setConsolidadoDateTo] = useState("")
  const [nfsSort, setNfsSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "DATA VENCTO",
    direction: "desc",
  })
  const [consolidadoSort, setConsolidadoSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "DATA VENCTO",
    direction: "desc",
  })
  const [nfsPage, setNfsPage] = useState(1)
  const [consolidadoPage, setConsolidadoPage] = useState(1)
  const [expandedConsolidados, setExpandedConsolidados] = useState<string[]>([])
  const [hiddenNaturezas, setHiddenNaturezas] = useState<string[]>([])
  const [showAllOverdue, setShowAllOverdue] = useState(false)

  useEffect(() => {
    setHasFetchedTab({
      "visao-geral": false,
      nfs: false,
      consolidado: false,
      "resumo-forecast": false,
    })
    setNfsRows([])
    setConsolidadoRows([])
    setResumoRows([])
    setExecutiveSummary(null)
    setBurnRate([])
    setSupplierConcentration(null)
    setForecast(null)
    setOverdueRows([])
  }, [sessionId])

  useEffect(() => {
    let active = true
    const loadTabData = async () => {
      if (hasFetchedTab[activeTab]) {
        if (active) setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        if (activeTab === "visao-geral") {
          const [nextNfs, nextExecutive, nextBurnRate, nextSuppliers, nextForecast, nextOverdue] = await Promise.all([
            fetchApiJson<PaginatedResponse<GenericRow>>(`/api/custos/${sessionId}/nfs?page=1&page_size=5000`).catch(() => ({ data: [], total: 0, page: 1, page_size: 5000, pages: 0 })),
            fetchApiJson<ExecutiveSummary>(`/api/analytics/${sessionId}/executive-summary`).catch(() => null),
            fetchApiJson<BurnRateItem[]>(`/api/analytics/${sessionId}/burn-rate`).catch(() => []),
            fetchApiJson<SupplierRankingItem[]>(`/api/templates/custos/fornecedor-ranking/${sessionId}?limit=10`).catch(() => []),
            fetchApiJson<ForecastResponse>(`/api/analytics/${sessionId}/forecast?horizon_months=4`).catch(() => null),
            fetchApiJson<OverdueItem[]>(`/api/analytics/${sessionId}/overdue`).catch(() => []),
          ])
          if (!active) return
          const hhi = nextSuppliers.reduce((sum, item) => sum + (item.participacao / 100) ** 2, 0)
          setNfsRows(nextNfs.data ?? [])
          setExecutiveSummary(nextExecutive)
          setBurnRate(nextBurnRate)
          setSupplierConcentration({
            top_10: nextSuppliers.map((item) => ({
              fornecedor: item.fornecedor,
              valor_total: item.valor,
              pct_total: item.participacao,
              count_nfs: item.count,
            })),
            herfindahl_index: Math.round(hhi * 10000) / 10000,
            risk_level: hhi > 0.25 ? "alto" : hhi > 0.15 ? "medio" : "baixo",
          })
          setForecast(nextForecast)
          setOverdueRows(nextOverdue)
          setHiddenNaturezas([])
        }

        if (activeTab === "nfs") {
          const nextNfs = await fetchApiJson<PaginatedResponse<GenericRow>>(`/api/custos/${sessionId}/nfs?page=1&page_size=5000`).catch(() => ({ data: [], total: 0, page: 1, page_size: 5000, pages: 0 }))
          if (!active) return
          setNfsRows(nextNfs.data ?? [])
        }

        if (activeTab === "consolidado") {
          const nextConsolidado = await fetchApiJson<PaginatedResponse<GenericRow>>(`/api/custos/${sessionId}/consolidado?page=1&page_size=5000`).catch(() => ({ data: [], total: 0, page: 1, page_size: 5000, pages: 0 }))
          if (!active) return
          setConsolidadoRows(nextConsolidado.data ?? [])
          setExpandedConsolidados([])
        }

        if (activeTab === "resumo-forecast") {
          const [nextResumo, nextForecast, nextOverdue] = await Promise.all([
            fetchApiJson<GenericRow[] | { rows?: GenericRow[] }>(`/api/custos/${sessionId}/resumo`).catch(() => []),
            fetchApiJson<ForecastResponse>(`/api/analytics/${sessionId}/forecast?horizon_months=4`).catch(() => null),
            fetchApiJson<OverdueItem[]>(`/api/analytics/${sessionId}/overdue`).catch(() => []),
          ])
          if (!active) return
          setResumoRows(Array.isArray(nextResumo) ? nextResumo : nextResumo.rows ?? [])
          setForecast(nextForecast)
          setOverdueRows(nextOverdue)
        }

        if (active) {
          setHasFetchedTab((current) => ({ ...current, [activeTab]: true }))
        }
      } catch (fetchError: unknown) {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar o dashboard de custos.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTabData()

    return () => {
      active = false
    }
  }, [activeTab, hasFetchedTab, sessionId])

  const naturezaOptions = useMemo(
    () =>
      Array.from(new Set(nfsRows.map((row) => String(row["NATUREZA"] ?? "").trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      ),
    [nfsRows],
  )

  const consolidadoNaturezaOptions = useMemo(
    () =>
      Array.from(new Set(consolidadoRows.map((row) => String(row["NATUREZA"] ?? "").trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      ),
    [consolidadoRows],
  )

  const filteredNfs = useMemo(() => {
    const filtered = nfsRows.filter((row) => {
      const natureza = String(row["NATUREZA"] ?? "").trim()
      const fornecedor = String(row["FORNECEDOR"] ?? "").trim()
      const situacao = resolveSituation(row["SITUAÇÃO PLANILHA"], row["DATA VENCTO"])
      const dueDate = parseDateValue(row["DATA VENCTO"])
      const matchesNatureza = selectedNaturezas.length === 0 || selectedNaturezas.includes(natureza)
      const matchesSituacao = selectedSituacao === "Todas" || situacao === selectedSituacao
      const matchesFornecedor =
        !fornecedorSearch || normalizeText(fornecedor).includes(normalizeText(fornecedorSearch))
      const matchesDateFrom = !dateFrom || (dueDate !== null && dueDate >= new Date(`${dateFrom}T00:00:00`))
      const matchesDateTo = !dateTo || (dueDate !== null && dueDate <= new Date(`${dateTo}T23:59:59`))
      return matchesNatureza && matchesSituacao && matchesFornecedor && matchesDateFrom && matchesDateTo
    })
    return sortRows(
      filtered,
      nfsSort.key,
      nfsSort.direction,
      nfsSort.key === "DATA VENCTO",
      nfsSort.key === "VALOR",
    )
  }, [dateFrom, dateTo, fornecedorSearch, nfsRows, nfsSort.direction, nfsSort.key, selectedNaturezas, selectedSituacao])

  const filteredConsolidado = useMemo(() => {
    const filtered = consolidadoRows.filter((row) => {
      const natureza = String(row["NATUREZA"] ?? "").trim()
      const dueDate = parseDateValue(row["DATA VENCTO"])
      const matchesNatureza =
        selectedConsolidadoNaturezas.length === 0 || selectedConsolidadoNaturezas.includes(natureza)
      const matchesDateFrom =
        !consolidadoDateFrom || (dueDate !== null && dueDate >= new Date(`${consolidadoDateFrom}T00:00:00`))
      const matchesDateTo =
        !consolidadoDateTo || (dueDate !== null && dueDate <= new Date(`${consolidadoDateTo}T23:59:59`))
      return matchesNatureza && matchesDateFrom && matchesDateTo
    })
    return sortRows(
      filtered,
      consolidadoSort.key,
      consolidadoSort.direction,
      consolidadoSort.key === "DATA VENCTO",
      consolidadoSort.key === "VALOR",
    )
  }, [consolidadoDateFrom, consolidadoDateTo, consolidadoRows, consolidadoSort.direction, consolidadoSort.key, selectedConsolidadoNaturezas])

  const nfsSummary = useMemo(() => {
    const totalFiltered = filteredNfs.reduce((sum, row) => sum + parseNumber(row["VALOR"]), 0)
    return { total: totalFiltered, count: filteredNfs.length, all: nfsRows.length }
  }, [filteredNfs, nfsRows.length])

  const nfsPageData = paginate(filteredNfs, nfsPage)

  const consolidadoGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { consolidado: string; total: number; count: number; items: GenericRow[]; fornecedor: string }
    >()
    for (const row of filteredConsolidado) {
      const consolidado = String(row["Nº CONSOLIDADO"] ?? "Sem consolidado")
      const current = grouped.get(consolidado) ?? {
        consolidado,
        total: 0,
        count: 0,
        items: [],
        fornecedor: String(row["FORNECEDOR"] ?? ""),
      }
      current.items.push(row)
      current.count += 1
      current.total += parseNumber(row["VALOR"])
      grouped.set(consolidado, current)
    }
    return Array.from(grouped.values()).sort((left, right) => right.total - left.total)
  }, [filteredConsolidado])

  const consolidadoPageData = paginate(consolidadoGroups, consolidadoPage)

  const piePagamentoData = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of nfsRows) {
      const method = String(row["BOLETO/DEPÓSITO"] ?? "Não informado").trim() || "Não informado"
      grouped.set(method, (grouped.get(method) ?? 0) + parseNumber(row["VALOR"]))
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }))
  }, [nfsRows])

  const consolidadoBarData = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of nfsRows) {
      const consolidado = String(row["Nº CONSOLIDADO"] ?? "Sem consolidado")
      grouped.set(consolidado, (grouped.get(consolidado) ?? 0) + parseNumber(row["VALOR"]))
    }
    return Array.from(grouped.entries())
      .map(([consolidado, valor]) => ({ consolidado, valor }))
      .sort((left, right) => right.valor - left.valor)
      .slice(0, 12)
  }, [nfsRows])

  const monthlyNaturezaData = useMemo(() => {
    const allNaturezas = Array.from(
      new Set(
        burnRate.flatMap((item) => item.by_natureza?.map((natureza) => natureza.natureza) ?? []),
      ),
    )
    return burnRate.map((item) => {
      const next: Record<string, string | number> = {
        mes: item.mes,
        mes_nome: item.mes_nome,
        valor_nfs: item.valor_nfs,
        valor_acumulado: item.valor_acumulado,
      }
      for (const natureza of allNaturezas) {
        const match = item.by_natureza?.find((entry) => entry.natureza === natureza)
        next[natureza] = match?.valor ?? 0
      }
      return next
    })
  }, [burnRate])

  const visibleNaturezas = useMemo(
    () =>
      Array.from(
        new Set(
          burnRate.flatMap((item) => item.by_natureza?.map((natureza) => natureza.natureza) ?? []),
        ),
      ).filter((natureza) => !hiddenNaturezas.includes(natureza)),
    [burnRate, hiddenNaturezas],
  )

  const resumoTotals = useMemo(() => {
    return resumoRows.reduce<{ totalGeral: number; materialServico: number; maoObra: number; taxaAdm: number }>(
      (acc, row) => ({
        totalGeral: acc.totalGeral + parseNumber(row["TOTAL GERAL"]),
        materialServico: acc.materialServico + parseNumber(row["MATERIAL/SERVIÇO"]),
        maoObra:
          acc.maoObra + parseNumber(row["MÃO OBRA EMPREITADA"]) + parseNumber(row["MÃO OBRA TEMPO"]),
        taxaAdm: acc.taxaAdm + parseNumber(row["TAXA ADMINISTRAÇÃO"]),
      }),
      { totalGeral: 0, materialServico: 0, maoObra: 0, taxaAdm: 0 },
    )
  }, [resumoRows])

  const latestMonthValue = burnRate[burnRate.length - 1]?.valor_nfs ?? 0

  const topSupplierText = supplierConcentration
    ? `HHI: ${formatPct(supplierConcentration.herfindahl_index * 100)} - Concentracao: ${supplierConcentration.risk_level}`
    : "Sem concentracao calculada."
  const topSuppliers = supplierConcentration?.top_10 ?? []

  const forecastChartData = useMemo(() => {
    const historical = burnRate.map((item) => ({
      label: item.mes_nome,
      historico: item.valor_nfs,
      forecast: null,
      lower: null,
      upper: null,
    }))
    const projected = (forecast?.projected_monthly ?? []).map((item) => ({
      label: `+${item.mes_offset}`,
      historico: null,
      forecast: item.valor_previsto,
      lower: item.lower_bound,
      upper: item.upper_bound,
    }))
    return [...historical, ...projected]
  }, [burnRate, forecast])

  const overdueVisible = showAllOverdue ? overdueRows : overdueRows.slice(0, 10)

  const hasNfsFilters = selectedNaturezas.length > 0 || selectedSituacao !== "Todas" || fornecedorSearch || dateFrom || dateTo
  const hasConsolidadoFilters = selectedConsolidadoNaturezas.length > 0 || consolidadoDateFrom || consolidadoDateTo

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 20 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <PanelSkeleton key={index} height={110} dark />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20 }}>
          <PanelSkeleton height={320} />
          <div style={{ display: "grid", gap: 20 }}>
            <PanelSkeleton height={150} />
            <PanelSkeleton height={150} />
          </div>
        </div>
        <PanelSkeleton height={360} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <PanelSkeleton key={index} height={180} />
          ))}
        </div>
        <style>{skeletonAnimation}</style>
      </div>
    )
  }

  if (error) {
    return <EmptyState icon="⚠" title="Erro ao carregar custos" message={error} />
  }

  if (nfsRows.length === 0 && consolidadoRows.length === 0 && resumoRows.length === 0) {
    return (
      <EmptyState
        icon="📂"
        title="Dados de custos indisponíveis"
        message="Este dashboard requer um arquivo com colunas como NATUREZA, FORNECEDOR, VALOR e DATA VENCTO."
      />
    )
  }

  return (
    <SchemaGuard requires={["custos", "orcamento"]}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Controle de Custos</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          Visão executiva de NFs, consolidado, forecast e concentração de fornecedores.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid #dbe4ea", overflowX: "auto" }}>
        {TAB_LABELS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: "transparent",
                borderBottom: isActive ? `3px solid ${BRAND_GREEN}` : "3px solid transparent",
                color: isActive ? BRAND_GREEN : "#64748b",
                padding: "0 4px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "visao-geral" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 20 }}>
            {[
              { label: "Total NFs", value: formatInt(executiveSummary?.total_nfs ?? nfsRows.length), color: ACCENT_BLUE },
              {
                label: "Valor Total",
                value: formatCurrency(executiveSummary?.total_realizado ?? nfsSummary.total),
                color: ACCENT_BLUE,
              },
              {
                label: "Média / NF",
                value: formatCurrency((executiveSummary?.total_realizado ?? nfsSummary.total) / Math.max(executiveSummary?.total_nfs ?? nfsRows.length, 1)),
                color: ACCENT_AMBER,
              },
              {
                label: "Fornecedores",
                value: formatInt(executiveSummary?.fornecedores_ativos ?? new Set(nfsRows.map((row) => row["FORNECEDOR"])).size),
                color: ACCENT_PURPLE,
              },
              { label: "Consolidados", value: formatInt(consolidadoBarData.length), color: ACCENT_TEAL },
              { label: "Período Atual", value: formatCurrency(latestMonthValue), color: ACCENT_RED },
            ].map((card) => (
              <div key={card.label} style={DARK_CARD}>
                <p style={darkLabelStyle}>{card.label}</p>
                <p style={{ margin: "10px 0 0", fontSize: 27, fontWeight: 800, color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20 }}>
            <section style={PANEL}>
              <div style={panelHeaderStyle}>
                <div>
                  <h3 style={panelTitleStyle}>Top 10 Fornecedores</h3>
                  <p style={panelSubtitleStyle}>Participação no valor realizado</p>
                </div>
              </div>
              {topSuppliers.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topSuppliers} layout="vertical" margin={{ top: 8, right: 20, left: 12, bottom: 8 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                      <YAxis dataKey="fornecedor" type="category" width={180} tick={{ fill: "#0f172a", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor_total" radius={[0, 8, 8, 0]}>
                        {topSuppliers.map((entry, index) => (
                          <Cell key={`${entry.fornecedor}-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p style={{ margin: "14px 0 0", fontSize: 12, color: "#64748b", fontWeight: 700 }}>{topSupplierText}</p>
                </>
              ) : (
                <EmptyState icon="🏗" title="Sem fornecedores" message="Não há fornecedores suficientes para montar o ranking." />
              )}
            </section>

            <div style={{ display: "grid", gap: 20 }}>
              <section style={PANEL}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Método de Pagamento</h3>
                    <p style={panelSubtitleStyle}>Composição por valor de NF</p>
                  </div>
                </div>
                {piePagamentoData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={piePagamentoData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={3}>
                        {piePagamentoData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon="💳" title="Sem pagamentos" message="Não há métodos de pagamento suficientes para o gráfico." />
                )}
              </section>

              <section style={PANEL}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Valor por Consolidado</h3>
                    <p style={panelSubtitleStyle}>Top consolidados por valor</p>
                  </div>
                </div>
                {consolidadoBarData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={consolidadoBarData}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="consolidado" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor" fill={ACCENT_TEAL} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon="📦" title="Sem consolidados" message="Não há consolidados suficientes para visualização." />
                )}
              </section>
            </div>
          </div>

          <section style={PANEL}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={panelTitleStyle}>Evolução Mensal — Custos por Natureza</h3>
                <p style={panelSubtitleStyle}>Barras empilhadas por natureza e linha de acumulado</p>
              </div>
            </div>
            {monthlyNaturezaData.length ? (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={monthlyNaturezaData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="mes_nome" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {visibleNaturezas.map((natureza, index) => (
                      <Bar key={natureza} yAxisId="left" dataKey={natureza} stackId="naturezas" fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={index === visibleNaturezas.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Line yAxisId="right" type="monotone" dataKey="valor_acumulado" stroke={BRAND_GREEN} strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  {Array.from(
                    new Set(
                      burnRate.flatMap((item) => item.by_natureza?.map((natureza) => natureza.natureza) ?? []),
                    ),
                  ).map((natureza, index) => {
                    const hidden = hiddenNaturezas.includes(natureza)
                    return (
                      <button
                        key={natureza}
                        type="button"
                        onClick={() =>
                          setHiddenNaturezas((current) =>
                            hidden ? current.filter((item) => item !== natureza) : [...current, natureza],
                          )
                        }
                        style={{
                          border: "1px solid rgba(11,79,58,0.12)",
                          background: hidden ? "#f8fafc" : "#fff",
                          color: hidden ? "#94a3b8" : "#0f172a",
                          borderRadius: 999,
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: SERIES_COLORS[index % SERIES_COLORS.length],
                            display: "inline-block",
                            marginRight: 8,
                          }}
                        />
                        {natureza}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <EmptyState icon="📈" title="Sem evolução mensal" message="Ainda não há histórico suficiente para montar a evolução mensal." />
            )}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            <section style={PANEL}>
              <h3 style={panelTitleStyle}>Orçado vs Realizado</h3>
              <p style={panelSubtitleStyle}>Percentual de consumo do orçamento</p>
              <p style={{ margin: "18px 0 10px", fontSize: 28, fontWeight: 800, color: riskColor(executiveSummary?.pct_consumido ?? 0) }}>
                {formatPct(executiveSummary?.pct_consumido ?? 0)}
              </p>
              <div style={progressTrackStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${Math.min(executiveSummary?.pct_consumido ?? 0, 100)}%`,
                    background: riskColor(executiveSummary?.pct_consumido ?? 0),
                  }}
                />
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b" }}>
                Saldo atual: {formatCurrency(executiveSummary?.saldo ?? 0)}
              </p>
            </section>

            <section style={PANEL}>
              <h3 style={panelTitleStyle}>Custo Previsto Final</h3>
              <p style={panelSubtitleStyle}>Projeção com regressão linear</p>
              <p style={{ margin: "18px 0 6px", fontSize: 28, fontWeight: 800, color: ACCENT_BLUE }}>
                {formatCurrency(forecast?.projected_final_cost ?? 0)}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                ± {formatCurrency(((forecast?.confidence_interval_90?.[1] ?? 0) - (forecast?.projected_final_cost ?? 0)) || 0)}
              </p>
            </section>

            <section style={PANEL}>
              <h3 style={panelTitleStyle}>Probabilidade de Estouro</h3>
              <p style={panelSubtitleStyle}>Risco de ultrapassar o orçamento</p>
              <p style={{ margin: "18px 0 10px", fontSize: 28, fontWeight: 800, color: riskColor((forecast?.overrun_probability ?? 0) * 100) }}>
                {formatPct((forecast?.overrun_probability ?? 0) * 100)}
              </p>
              <div style={progressTrackStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${Math.min((forecast?.overrun_probability ?? 0) * 100, 100)}%`,
                    background: riskColor((forecast?.overrun_probability ?? 0) * 100),
                  }}
                />
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "nfs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section style={PANEL}>
            <div style={filterRowStyle}>
              <label style={filterLabelStyle}>
                Natureza
                <select
                  multiple
                  value={selectedNaturezas}
                  onChange={(event) => {
                    setSelectedNaturezas(Array.from(event.target.selectedOptions, (option) => option.value))
                    setNfsPage(1)
                  }}
                  style={{ ...selectStyle, width: 200, minHeight: 96 }}
                >
                  {naturezaOptions.map((natureza) => (
                    <option key={natureza} value={natureza}>
                      {natureza}
                    </option>
                  ))}
                </select>
              </label>
              <label style={filterLabelStyle}>
                Situação
                <select value={selectedSituacao} onChange={(event) => setSelectedSituacao(event.target.value)} style={{ ...inputStyle, width: 180 }}>
                  {SITUACAO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label style={filterLabelStyle}>
                Fornecedor
                <input value={fornecedorSearch} onChange={(event) => setFornecedorSearch(event.target.value)} placeholder="Buscar fornecedor" style={{ ...inputStyle, width: 220 }} />
              </label>
              <label style={filterLabelStyle}>
                Data vencto de
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
              </label>
              <label style={filterLabelStyle}>
                até
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
              </label>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  setSelectedNaturezas([])
                  setSelectedSituacao("Todas")
                  setFornecedorSearch("")
                  setDateFrom("")
                  setDateTo("")
                  setNfsPage(1)
                }}
              >
                Limpar
              </button>
              {hasNfsFilters && <span style={activeBadgeStyle}>Filtros ativos</span>}
            </div>
          </section>

          <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            Exibindo {formatInt(nfsSummary.count)} de {formatInt(nfsSummary.all)} NFs — Total filtrado: {formatCurrency(nfsSummary.total)}
          </p>

          <section style={PANEL}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "Nº CONSOLIDADO",
                      "COD",
                      "FORNECEDOR",
                      "NF",
                      "MAPA PREÇOS",
                      "NATUREZA",
                      "BOLETO/DEPÓSITO",
                      "DATA VENCTO",
                      "VALOR",
                      "ITEM PLANILHA",
                      "SITUAÇÃO PLANILHA",
                      "SALDO PLANILHA",
                    ].map((column) => (
                      <th
                        key={column}
                        style={thStyle}
                        onClick={() => {
                          if (!["VALOR", "DATA VENCTO", "FORNECEDOR"].includes(column)) return
                          setNfsSort((current) => ({
                            key: column,
                            direction: current.key === column && current.direction === "asc" ? "desc" : "asc",
                          }))
                        }}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nfsPageData.rows.map((row, index) => {
                    const situacao = resolveSituation(row["SITUAÇÃO PLANILHA"], row["DATA VENCTO"])
                    const natureza = String(row["NATUREZA"] ?? "").trim()
                    return (
                      <tr
                        key={`${String(row["NF"] ?? "")}-${index}`}
                        style={{
                          background: index % 2 === 0 ? "#fff" : "#f9fafb",
                          boxShadow: natureza ? "none" : `inset 3px 0 0 ${ACCENT_AMBER}`,
                        }}
                      >
                        <td style={tdStyle}>{String(row["Nº CONSOLIDADO"] ?? "-")}</td>
                        <td style={tdStyle}>{String(row["COD"] ?? "-")}</td>
                        <td style={tdStyle}>{String(row["FORNECEDOR"] ?? "-")}</td>
                        <td style={tdStyle}>{String(row["NF"] ?? "-")}</td>
                        <td style={tdStyle}>{String(row["MAPA PREÇOS"] ?? "-")}</td>
                        <td style={tdStyle}>{natureza || "-"}</td>
                        <td style={tdStyle}>{String(row["BOLETO/DEPÓSITO"] ?? "-")}</td>
                        <td style={tdStyle}>{formatDate(row["DATA VENCTO"])}</td>
                        <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(parseNumber(row["VALOR"]))}</td>
                        <td style={tdStyle}>{String(row["ITEM PLANILHA"] ?? "-")}</td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(situacao)}>{situacao}</span>
                        </td>
                        <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(parseNumber(row["SALDO PLANILHA"]))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={nfsPageData.page}
              totalPages={nfsPageData.totalPages}
              start={nfsPageData.start}
              end={nfsPageData.end}
              total={filteredNfs.length}
              onChange={setNfsPage}
            />
          </section>
        </div>
      )}

      {activeTab === "consolidado" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section style={PANEL}>
            <div style={filterRowStyle}>
              <label style={filterLabelStyle}>
                Data de
                <input type="date" value={consolidadoDateFrom} onChange={(event) => setConsolidadoDateFrom(event.target.value)} style={inputStyle} />
              </label>
              <label style={filterLabelStyle}>
                até
                <input type="date" value={consolidadoDateTo} onChange={(event) => setConsolidadoDateTo(event.target.value)} style={inputStyle} />
              </label>
              <label style={filterLabelStyle}>
                Natureza
                <select
                  multiple
                  value={selectedConsolidadoNaturezas}
                  onChange={(event) => {
                    setSelectedConsolidadoNaturezas(Array.from(event.target.selectedOptions, (option) => option.value))
                    setConsolidadoPage(1)
                  }}
                  style={{ ...selectStyle, width: 220, minHeight: 96 }}
                >
                  {consolidadoNaturezaOptions.map((natureza) => (
                    <option key={natureza} value={natureza}>
                      {natureza}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  setConsolidadoDateFrom("")
                  setConsolidadoDateTo("")
                  setSelectedConsolidadoNaturezas([])
                  setConsolidadoPage(1)
                }}
              >
                Limpar
              </button>
              {hasConsolidadoFilters && <span style={activeBadgeStyle}>Filtros ativos</span>}
            </div>
          </section>

          <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            Exibindo {formatInt(filteredConsolidado.length)} de {formatInt(consolidadoRows.length)} — Total:{" "}
            {formatCurrency(filteredConsolidado.reduce((sum, row) => sum + parseNumber(row["VALOR"]), 0))}
          </p>

          <section style={PANEL}>
            {consolidadoPageData.rows.length ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {consolidadoPageData.rows.map((group) => {
                    const expanded = expandedConsolidados.includes(group.consolidado)
                    return (
                      <div key={group.consolidado} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedConsolidados((current) =>
                              expanded ? current.filter((item) => item !== group.consolidado) : [...current, group.consolidado],
                            )
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            background: "#f8fafc",
                            padding: "12px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          <span>{group.consolidado} — {group.fornecedor || "Fornecedor não informado"}</span>
                          <span>{formatInt(group.count)} NFs • {formatCurrency(group.total)}</span>
                        </button>
                        {expanded && (
                          <div style={{ overflowX: "auto" }}>
                            <table style={tableStyle}>
                              <thead>
                                <tr>
                                  {[
                                    "Nº CONSOLIDADO",
                                    "FORNECEDOR",
                                    "NF",
                                    "MAPA",
                                    "NATUREZA",
                                    "COND.PAGTO",
                                    "DATA VENCTO",
                                    "VALOR",
                                    "ITEM APROPRIAÇÃO",
                                    "VALOR APROPRIADO",
                                  ].map((column) => (
                                    <th key={column} style={thStyle}>
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((row, index) => (
                                  <tr key={`${group.consolidado}-${String(row["NF"] ?? "")}-${index}`} style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb" }}>
                                    <td style={tdStyle}>{String(row["Nº CONSOLIDADO"] ?? "-")}</td>
                                    <td style={tdStyle}>{String(row["FORNECEDOR"] ?? "-")}</td>
                                    <td style={tdStyle}>{String(row["NF"] ?? "-")}</td>
                                    <td style={tdStyle}>{String(row["MAPA"] ?? "-")}</td>
                                    <td style={tdStyle}>{String(row["NATUREZA"] ?? "-")}</td>
                                    <td style={tdStyle}>{String(row["COND.PAGTO"] ?? "-")}</td>
                                    <td style={tdStyle}>{formatDate(row["DATA VENCTO"])}</td>
                                    <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(parseNumber(row["VALOR"]))}</td>
                                    <td style={tdStyle}>{String(row["ITEM APROPRIAÇÃO"] ?? "-")}</td>
                                    <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(parseNumber(row["VALOR APROPRIADO"]))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <Pagination
                  page={consolidadoPageData.page}
                  totalPages={consolidadoPageData.totalPages}
                  start={consolidadoPageData.start}
                  end={consolidadoPageData.end}
                  total={consolidadoGroups.length}
                  onChange={setConsolidadoPage}
                />
              </>
            ) : (
              <EmptyState icon="📦" title="Sem consolidado" message="Nenhum consolidado atende aos filtros atuais." />
            )}
          </section>
        </div>
      )}

      {activeTab === "resumo-forecast" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 }}>
            {[
              { label: "Total Geral", value: resumoTotals.totalGeral, color: ACCENT_GREEN },
              { label: "Material/Serviço", value: resumoTotals.materialServico, color: ACCENT_BLUE },
              { label: "Mão Obra Total", value: resumoTotals.maoObra, color: ACCENT_AMBER },
              { label: "Taxa Adm Total", value: resumoTotals.taxaAdm, color: ACCENT_PURPLE },
            ].map((card: { label: string; value: number; color: string }) => (
              <div key={card.label} style={{ ...PANEL, borderTop: `3px solid ${card.color}` }}>
                <p style={lightLabelStyle}>{card.label}</p>
                <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>

          <section style={{ ...DARK_CARD, padding: 20 }}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={{ ...panelTitleStyle, color: "#f8fafc" }}>Previsão de Custo Final</h3>
                <p style={{ ...panelSubtitleStyle, color: "#94a3b8" }}>
                  {forecast?.data_points_used ?? 0} meses de histórico analisados
                </p>
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 34, fontWeight: 800, color: ACCENT_BLUE }}>
                {formatCurrency(forecast?.projected_final_cost ?? 0)}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#cbd5e1" }}>
                {formatCurrency(forecast?.confidence_interval_90?.[0] ?? 0)} —{" "}
                {formatCurrency(forecast?.confidence_interval_90?.[1] ?? 0)} (IC 90%)
              </p>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>
                <span>Probabilidade de estouro</span>
                <span>{formatPct((forecast?.overrun_probability ?? 0) * 100)}</span>
              </div>
              <div style={{ ...progressTrackStyle, background: "rgba(148,163,184,0.18)" }}>
                <div
                  style={{
                    ...progressFillStyle,
                    width: `${Math.min((forecast?.overrun_probability ?? 0) * 100, 100)}%`,
                    background: riskColor((forecast?.overrun_probability ?? 0) * 100),
                  }}
                />
              </div>
            </div>
            {forecastChartData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={forecastChartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="upper" stroke="transparent" fill="rgba(167,139,250,0.14)" activeDot={false} />
                  <Area type="monotone" dataKey="lower" stroke="transparent" fill="rgba(15,23,42,0.82)" activeDot={false} />
                  <Bar dataKey="historico" fill={ACCENT_BLUE} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="forecast" fill={ACCENT_PURPLE} radius={[8, 8, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="📉" title="Sem forecast" message="Ainda não há dados suficientes para a previsão financeira." />
            )}
          </section>

          {overdueRows.length > 0 && (
            <section style={PANEL}>
              <div style={panelHeaderStyle}>
                <div>
                  <h3 style={panelTitleStyle}>⚠ NFs em Atraso</h3>
                  <p style={panelSubtitleStyle}>Maiores atrasos por fornecedor</p>
                </div>
                <span style={activeBadgeStyle}>{overdueRows.length} itens</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Fornecedor", "NF", "Valor", "Vencimento", "Dias em Atraso"].map((column) => (
                        <th key={column} style={thStyle}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overdueVisible.map((row, index) => (
                      <tr key={`${row.fornecedor}-${row.nf}-${index}`} style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={tdStyle}>{row.fornecedor}</td>
                        <td style={tdStyle}>{row.nf}</td>
                        <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(row.valor)}</td>
                        <td style={tdStyle}>{formatDate(row.data_vencimento)}</td>
                        <td style={{ ...tdStyle, ...numberCellStyle, color: ACCENT_RED }}>{formatInt(row.days_overdue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {overdueRows.length > 10 && (
                <button type="button" style={{ ...primaryButtonStyle, marginTop: 16 }} onClick={() => setShowAllOverdue((current) => !current)}>
                  {showAllOverdue ? "Ver menos" : "Ver todas"}
                </button>
              )}
            </section>
          )}
        </div>
      )}
      </div>
    </SchemaGuard>
  )
}

function riskColor(value: number) {
  if (value > 85) return ACCENT_RED
  if (value > 70) return ACCENT_AMBER
  return ACCENT_GREEN
}

const skeletonAnimation = `
  @keyframes custos-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "#64748b",
}

const darkLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#cbd5e1",
}

const lightLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
}

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 20,
  flexWrap: "wrap",
  alignItems: "flex-end",
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
}

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid rgba(11,79,58,0.14)",
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
}

const selectStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(11,79,58,0.14)",
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
}

const primaryButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "none",
  background: BRAND_GREEN,
  color: "#fff",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(11,79,58,0.14)",
  background: "#fff",
  color: "#0f172a",
  padding: "0 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
}

const activeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(79,142,247,0.10)",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 700,
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
}

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  textAlign: "left",
  padding: "10px 12px",
  background: "#f8fafc",
  borderBottom: "2px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  color: "#64748b",
  whiteSpace: "nowrap",
  zIndex: 1,
  cursor: "pointer",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  fontWeight: 500,
  color: "#0f172a",
  whiteSpace: "nowrap",
}

const numberCellStyle: React.CSSProperties = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
}

const progressTrackStyle: React.CSSProperties = {
  width: "100%",
  height: 10,
  background: "#e2e8f0",
  borderRadius: 999,
  overflow: "hidden",
}

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const background =
    status === "PAGO"
      ? "rgba(52,201,126,0.12)"
      : status === "VENCIDO"
        ? "rgba(239,68,68,0.12)"
        : "rgba(245,166,35,0.14)"
  const color = status === "PAGO" ? "#15803d" : status === "VENCIDO" ? "#b91c1c" : "#b45309"
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: 700,
  }
}
