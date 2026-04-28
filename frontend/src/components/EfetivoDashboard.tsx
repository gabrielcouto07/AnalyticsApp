import React, { useEffect, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot,
  BarChart, Bar,
} from "recharts"
import { API_BASE_URL, templatesApiUrl } from "../api/client"

const COLORS = [
  "#4f8ef7", "#34c97e", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]

const MONTH_MAP: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  total_diarias: number
  unique_fornecedores: number
  unique_funcoes: number
  dias_ativos: number
  media_diaria: number
  obra: string
  ano: number
  meses_cobertos: number
  data_quality: { fornecedores: string[]; funcoes: string[] }
}

interface FuncaoRow {
  dia: number
  fornecedor: string
  funcao: string
  quantidade: number
}

interface MonthData {
  mes: number
  mes_nome: string
  fornecedores: string[]
  daily_pivot: Record<string, any>[]
  funcao_detail: FuncaoRow[]
}

interface TrendData {
  direction: "up" | "down" | "flat" | "unknown"
  slope?: number
  r_squared?: number
  strength?: "forte" | "moderada" | "fraca"
}

interface AnomalyPoint {
  data: string
  valor: number
}

type EfetivoTab = "visao-geral" | "por-filial" | "evolucao" | "detalhamento"
type DetailSortKey = "filial" | "fornecedor" | "cargo" | "periodo" | "dia" | "quantidade"

interface WorkRow {
  filial: string
  fornecedor: string
  cargo: string
  periodo: string
  mes: number
  dia: number
  quantidade: number
}

interface BranchRow {
  filial: string
  funcionarios: number
  percentage: number
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0)
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>Dia {label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.color, margin: "2px 0" }}>
          {e.dataKey}: <strong>{e.value}</strong>
        </p>
      ))}
      <p style={{ color: "#f1f5f9", marginTop: 6, borderTop: "1px solid #334155", paddingTop: 4 }}>
        Total: <strong>{total}</strong>
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const EfetivoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary]           = useState<Summary | null>(null)
  const [months, setMonths]             = useState<MonthData[]>([])
  const [trendTotal, setTrendTotal]     = useState<TrendData | null>(null)
  const [trendMedia, setTrendMedia]     = useState<TrendData | null>(null)
  const [anomalyPoints, setAnomalyPoints] = useState<AnomalyPoint[]>([])
  const [activeMes, setActiveMes]       = useState<number | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [warnings, setWarnings]         = useState<string[]>([])
  const [filterForn, setFilterForn]     = useState<string>("all")
  const [filterFuncao, setFilterFuncao] = useState<string>("all")
  const [showAllDias, setShowAllDias]   = useState(false)
  const [hiddenFornecedores, setHiddenFornecedores] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<EfetivoTab>("visao-geral")
  const [filterFilial, setFilterFilial] = useState<string[]>([])
  const [filterCargo, setFilterCargo] = useState<string[]>([])
  const [detailSort, setDetailSort] = useState<{ key: DetailSortKey; direction: "asc" | "desc" }>({
    key: "quantidade",
    direction: "desc",
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setWarnings([])
      try {
        const requests = await Promise.allSettled([
          fetch(templatesApiUrl(`/efetivo/analysis/${sessionId}`)).then(r => r.json()),
          fetch(templatesApiUrl(`/efetivo/monthly-breakdown/${sessionId}`)).then(r => r.json()),
          fetch(templatesApiUrl(`/efetivo/trend/${sessionId}?column=total_trabalhadores&window=7`)).then(r => r.json()),
          fetch(templatesApiUrl(`/efetivo/trend/${sessionId}?column=fornecedores&window=7`)).then(r => r.json()),
          fetch(templatesApiUrl(`/efetivo/anomalies/${sessionId}?method=iqr`)).then(r => r.json()),
        ])

        const nextWarnings: string[] = []

        const analysisRes = requests[0].status === "fulfilled" ? requests[0].value : null
        if (analysisRes?.summary) {
          setSummary(analysisRes.summary)
        } else {
          nextWarnings.push("Resumo não pôde ser carregado.")
        }

        const monthlyRes = requests[1].status === "fulfilled" ? requests[1].value : []
        if (Array.isArray(monthlyRes) && monthlyRes.length > 0) {
          setMonths(monthlyRes)
          setActiveMes(monthlyRes[0].mes)
        } else {
          nextWarnings.push("Série mensal indisponível.")
        }

        if (requests[2].status === "fulfilled") {
          setTrendTotal(requests[2].value)
        } else {
          nextWarnings.push("Tendência de total diário indisponível.")
        }

        if (requests[3].status === "fulfilled") {
          setTrendMedia(requests[3].value)
        } else {
          nextWarnings.push("Tendência de fornecedores/dia indisponível.")
        }

        if (requests[4].status === "fulfilled") {
          setAnomalyPoints(Array.isArray(requests[4].value?.points) ? requests[4].value.points : [])
        } else {
          nextWarnings.push("Detecção de anomalias indisponível.")
        }

        setWarnings(nextWarnings)

        if (!analysisRes?.summary && (!Array.isArray(monthlyRes) || monthlyRes.length === 0)) {
          setError("Erro ao carregar dados essenciais do Efetivo.")
        }
      } catch {
        setError("Erro ao carregar dados do Efetivo.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  const handleExport = async () => {
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
    } catch (e) {
      console.error("Erro ao exportar Efetivo", e)
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94a3b8" }}>Carregando Controle de Efetivo...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: "#fca5a5", background: "rgba(248,113,113,0.1)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)" }}>
      ⚠️ {error}
    </div>
  )

  const currentMonth = months.find(m => m.mes === activeMes) ?? months[0]
  const fornecedores = currentMonth?.fornecedores ?? []
  const grandMedia = summary ? summary.media_diaria : 0

  const allFornecedores = Array.from(new Set(currentMonth?.funcao_detail.map(r => r.fornecedor) ?? []))
  const allFuncoes = Array.from(new Set(currentMonth?.funcao_detail.map(r => r.funcao) ?? []))

  // Group funcao_detail by day, applying filters
  const funcaoPorDia: Record<number, FuncaoRow[]> = {}
  for (const row of currentMonth?.funcao_detail ?? []) {
    if (filterForn !== "all" && row.fornecedor !== filterForn) continue
    if (filterFuncao !== "all" && row.funcao !== filterFuncao) continue
    if (!funcaoPorDia[row.dia]) funcaoPorDia[row.dia] = []
    funcaoPorDia[row.dia].push(row)
  }
  const dias = Object.keys(funcaoPorDia).map(Number).sort((a, b) => a - b)
  const diasVisiveis = showAllDias ? dias : dias.slice(0, 7)

  const trendArrow = (trend: TrendData | null): string => {
    if (!trend || trend.direction === "unknown") return "→"
    if (trend.direction === "up") return trend.strength === "forte" ? "↑" : "↗"
    if (trend.direction === "down") return trend.strength === "forte" ? "↓" : "↘"
    return "→"
  }

  const monthKey = (currentMonth?.mes_nome || "").toLowerCase()
  const monthNumber = currentMonth?.mes ?? MONTH_MAP[monthKey] ?? 0
  const anomalyDaySet = new Set<number>()
  for (const p of anomalyPoints) {
    const dt = new Date(p.data)
    if (!Number.isNaN(dt.getTime()) && dt.getMonth() + 1 === monthNumber) {
      anomalyDaySet.add(dt.getDate())
    }
  }

  const fornecedorTotals = fornecedores.map((forn) => {
    const total = (currentMonth?.daily_pivot ?? []).reduce((sum, row) => sum + (Number(row[forn]) || 0), 0)
    return { fornecedor: forn, total }
  }).sort((a, b) => b.total - a.total)

  const obraLabel = summary?.obra?.trim() || "Obra não identificada"
  const workRows: WorkRow[] = months.flatMap((month) =>
    (month.funcao_detail ?? [])
      .filter((row) => Number(row.quantidade) > 0)
      .map((row) => ({
        filial: obraLabel,
        fornecedor: row.fornecedor || "-",
        cargo: row.funcao || "-",
        periodo: month.mes_nome || String(month.mes),
        mes: month.mes,
        dia: row.dia,
        quantidade: Number(row.quantidade) || 0,
      })),
  )

  const filialOptions = Array.from(new Set(workRows.map((row) => row.filial).filter(Boolean))).sort()
  const cargoOptions = Array.from(new Set(workRows.map((row) => row.cargo).filter(Boolean))).sort()
  const filteredWorkRows = workRows.filter((row) => {
    const filialOk = filterFilial.length === 0 || filterFilial.includes(row.filial)
    const cargoOk = filterCargo.length === 0 || filterCargo.includes(row.cargo)
    return filialOk && cargoOk
  })
  const totalFuncionarios = filteredWorkRows.reduce((sum, row) => sum + row.quantidade, 0)
  const totalForCompleteness = Math.max(filteredWorkRows.length, 1)
  const completenessFields: Array<keyof WorkRow> = ["filial", "fornecedor", "cargo", "periodo", "dia", "quantidade"]
  const completeCells = filteredWorkRows.reduce((sum, row) => (
    sum + completenessFields.filter((field) => row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== "").length
  ), 0)
  const completeness = filteredWorkRows.length
    ? Math.round((completeCells / (totalForCompleteness * completenessFields.length)) * 100)
    : 0
  const branchRows: BranchRow[] = Array.from(
    filteredWorkRows.reduce((acc, row) => {
      acc.set(row.filial, (acc.get(row.filial) ?? 0) + row.quantidade)
      return acc
    }, new Map<string, number>()),
  )
    .map(([filial, funcionarios]) => ({
      filial,
      funcionarios,
      percentage: totalFuncionarios ? Number(((funcionarios / totalFuncionarios) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.funcionarios - a.funcionarios)

  const evolutionData = Array.from(
    filteredWorkRows.reduce((acc, row) => {
      const existing = acc.get(row.mes) ?? { periodo: row.periodo, mes: row.mes, funcionarios: 0 }
      existing.funcionarios += row.quantidade
      acc.set(row.mes, existing)
      return acc
    }, new Map<number, { periodo: string; mes: number; funcionarios: number }>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => a.mes - b.mes)

  const sortedDetailRows = [...filteredWorkRows].sort((a, b) => {
    const left = a[detailSort.key]
    const right = b[detailSort.key]
    const direction = detailSort.direction === "asc" ? 1 : -1
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * direction
    }
    return String(left).localeCompare(String(right), "pt-BR") * direction
  })

  const selectMultiValues = (options: HTMLOptionsCollection): string[] =>
    Array.from(options).filter((option) => option.selected).map((option) => option.value)

  const setSort = (key: DetailSortKey) => {
    setDetailSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
          🏗️ Controle de Efetivo — {summary?.obra}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          {summary?.ano} · {summary?.meses_cobertos} {summary?.meses_cobertos === 1 ? "mês" : "meses"} · {summary?.unique_fornecedores} fornecedores · {summary?.unique_funcoes} funções
        </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          style={{
            background: "#0b4f3a",
            color: "#fff",
            border: "1px solid rgba(203,187,160,0.35)",
            borderRadius: 8,
            padding: "8px 16px",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ⬇ Exportar
        </button>
      </div>

      {warnings.length > 0 && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fcd34d", fontSize: 12 }}>
          ⚠️ Algumas análises não foram carregadas: {warnings.join(" ")}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 24, gap: 16 }}>
        {([
          { id: "visao-geral" as const, label: "Visão Geral" },
          { id: "por-filial" as const, label: "Por Filial" },
          { id: "evolucao" as const, label: "Evolução" },
          { id: "detalhamento" as const, label: "Detalhamento" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === tab.id ? "2px solid #0b4f3a" : "2px solid transparent",
              color: activeTab === tab.id ? "#0b4f3a" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 600,
              padding: "0 2px 10px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === "visao-geral" || activeTab === "por-filial") && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "#fff", border: "1px solid rgba(11,79,58,0.12)", borderRadius: 12, padding: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
            Filial
            <select
              multiple
              value={filterFilial}
              onChange={(event) => setFilterFilial(selectMultiValues(event.currentTarget.options))}
              style={{ ...filterSelectStyle, minHeight: 72 }}
            >
              {filialOptions.map((filial) => <option key={filial} value={filial}>{filial}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
            Cargo / Função
            <select
              multiple
              value={filterCargo}
              onChange={(event) => setFilterCargo(selectMultiValues(event.currentTarget.options))}
              style={{ ...filterSelectStyle, minHeight: 72 }}
            >
              {cargoOptions.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setFilterFilial([])
              setFilterCargo([])
            }}
            style={{ background: "#cbbba0", color: "#0b4f3a", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            Limpar Filtros
          </button>
        </div>
      )}

      {activeTab === "visao-geral" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Total Funcionários", value: totalFuncionarios.toLocaleString("pt-BR") },
              { label: "Filiais/Obras Ativas", value: String(new Set(filteredWorkRows.map((row) => row.filial)).size) },
              { label: "Cargos Distintos", value: String(new Set(filteredWorkRows.map((row) => row.cargo)).size) },
              { label: "% Dados Completos", value: `${completeness}%` },
            ].map((card) => (
              <div key={card.label} style={kpiCardStyle}>
                <p style={kpiLabelStyle}>{card.label}</p>
                <p style={kpiValueStyle}>{card.value}</p>
              </div>
            ))}
          </div>

          <div style={lightCardStyle}>
            <h3 style={lightTitleStyle}>Headcount por Filial / Obra</h3>
            {branchRows.length === 0 ? (
              <p style={emptyStateStyle}>Não há dados de filial ou obra para os filtros selecionados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis type="category" dataKey="filial" width={180} tick={{ fill: "#0f172a", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Diárias", value: summary?.total_diarias.toLocaleString("pt-BR"), color: "#4f8ef7", icon: "📋", trend: trendArrow(trendTotal) },
          { label: "Dias Ativos",   value: summary?.dias_ativos,                           color: "#34c97e", icon: "📅" },
          { label: "Média Diária",  value: summary?.media_diaria,                          color: "#f5a623", icon: "📊", trend: trendArrow(trendMedia) },
          { label: "Fornecedores",  value: summary?.unique_fornecedores,                   color: "#a78bfa", icon: "🏢" },
          { label: "Funções",       value: summary?.unique_funcoes,                        color: "#06b6d4", icon: "👷" },
        ].map(({ label, value, color, icon, trend }) => (
          <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${color}30`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{icon} {label} {trend ? ` ${trend}` : ""}</p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color }}>{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* ── Month Tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {months.map(m => (
          <button
            key={m.mes}
            onClick={() => {
              setActiveMes(m.mes)
              setFilterForn("all")
              setFilterFuncao("all")
              setShowAllDias(false)
              setHiddenFornecedores([])
            }}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              background: activeMes === m.mes ? "#4f8ef7" : "rgba(30,41,59,0.8)",
              color: activeMes === m.mes ? "#fff" : "#94a3b8",
              transition: "all 0.15s",
            }}
          >
            {m.mes_nome}
          </button>
        ))}
      </div>

      {currentMonth && (
        <>
          {/* ── Line Chart per Month ─────────────────────────────────── */}
          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              📈 Serviços Presentes por Dia — {currentMonth.mes_nome}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#94a3b8" }}>
              Trabalhadores por dia por fornecedor
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={currentMonth.daily_pivot} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="Dia" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Dia", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 12, cursor: "pointer" }}
                  onClick={(payload: any) => {
                    const key = payload?.dataKey
                    if (!key) return
                    setHiddenFornecedores(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
                  }}
                />
                <ReferenceLine y={grandMedia} stroke="#475569" strokeDasharray="5 5"
                  label={{ value: `Média geral: ${grandMedia}`, fill: "#64748b", fontSize: 10, position: "right" }} />
                {[...anomalyDaySet].map(day => {
                  const dayRow = currentMonth.daily_pivot.find(r => Number(r.Dia) === day)
                  const total = fornecedores.reduce((sum, forn) => sum + (Number(dayRow?.[forn]) || 0), 0)
                  return <ReferenceDot key={`anom-${day}`} x={day} y={total} r={6} fill="#ef4444" stroke="#7f1d1d" />
                })}
                {fornecedores.map((forn, i) => (
                  <Line key={forn} type="monotone" dataKey={forn}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} connectNulls
                    hide={hiddenFornecedores.includes(forn)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              📶 Totais por Fornecedor — {currentMonth.mes_nome}
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, fornecedorTotals.length * 36)}>
              <BarChart data={fornecedorTotals} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="fornecedor" width={180} tick={{ fill: "#f1f5f9", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#4f8ef7" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Serviços por Dia (funções) ────────────────────────────── */}
          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                  👷 Serviços por Dia — {currentMonth.mes_nome}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                  Quais funções estavam presentes em cada dia
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={filterForn} onChange={e => setFilterForn(e.target.value)} style={selectStyle}>
                  <option value="all">Todos fornecedores</option>
                  {allFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={filterFuncao} onChange={e => setFilterFuncao(e.target.value)} style={selectStyle}>
                  <option value="all">Todas funções</option>
                  {allFuncoes.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const rows: string[] = ["Dia,Fornecedor,Funcao,Quantidade"]
                    for (const dia of dias) {
                      for (const row of funcaoPorDia[dia]) {
                        rows.push(`${dia},"${row.fornecedor}","${row.funcao}",${row.quantidade}`)
                      }
                    }
                    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `efetivo_${currentMonth.mes_nome.toLowerCase()}_${sessionId}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ ...selectStyle, fontWeight: 700 }}
                >
                  Exportar CSV
                </button>
              </div>
            </div>

            {dias.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 13 }}>Nenhum dado para os filtros selecionados.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Dia</th>
                      <th style={thStyle}>Fornecedor</th>
                      <th style={thStyle}>Serviço / Função</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasVisiveis.map(dia =>
                      funcaoPorDia[dia].map((row, idx) => {
                        const colorIdx = fornecedores.indexOf(row.fornecedor)
                        const color = COLORS[colorIdx >= 0 ? colorIdx % COLORS.length : idx % COLORS.length]
                        return (
                          <tr key={`${dia}-${row.fornecedor}-${row.funcao}`}
                            style={{ background: dia % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                            {idx === 0 && (
                              <td rowSpan={funcaoPorDia[dia].length}
                                style={{ ...tdStyle, fontWeight: 800, color: "#94a3b8", verticalAlign: "middle", fontSize: 14, borderRight: "1px solid #334155" }}>
                                {String(dia).padStart(2, "0")}
                              </td>
                            )}
                            <td style={{ ...tdStyle, color, fontWeight: 600 }}>{row.fornecedor}</td>
                            <td style={{ ...tdStyle, color: "#f1f5f9" }}>{row.funcao}</td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color }}>{row.quantidade}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #334155" }}>
                      <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: "#f1f5f9" }}>Total no mês</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#f5a623" }}>
                        {dias.reduce((s, d) => s + funcaoPorDia[d].reduce((ss, r) => ss + r.quantidade, 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {dias.length > 7 && (
              <div style={{ position: "sticky", bottom: 0, marginTop: 10, paddingTop: 8, background: "linear-gradient(180deg, rgba(30,41,59,0), rgba(30,41,59,0.9) 35%)" }}>
                <button
                  type="button"
                  onClick={() => setShowAllDias(v => !v)}
                  style={{ ...selectStyle, width: "100%", fontWeight: 700 }}
                >
                  {showAllDias ? "Recolher" : `Mostrar todos os ${dias.length} dias`}
                </button>
              </div>
            )}
          </div>

          {/* ── Totais por Dia × Fornecedor ───────────────────────────── */}
          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              📋 Totais por Dia × Fornecedor — {currentMonth.mes_nome}
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Dia</th>
                    {fornecedores.map((f, i) => (
                      <th key={f} style={{ ...thStyle, color: COLORS[i % COLORS.length] }}>{f}</th>
                    ))}
                    <th style={{ ...thStyle, color: "#f5a623" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonth.daily_pivot.map((row, idx) => {
                    const total = fornecedores.reduce((s, f) => s + (Number(row[f]) || 0), 0)
                    return (
                      <tr key={row.Dia} style={{ background: idx % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#94a3b8" }}>
                          {String(row.Dia).padStart(2, "0")}
                        </td>
                        {fornecedores.map((f, i) => {
                          const val = Number(row[f]) || 0
                          return (
                            <td key={f} style={{ ...tdStyle, color: val > 0 ? COLORS[i % COLORS.length] : "#334155", fontWeight: val > 0 ? 600 : 400 }}>
                              {val > 0 ? val : "—"}
                            </td>
                          )
                        })}
                        <td style={{ ...tdStyle, fontWeight: 700, color: total > 0 ? "#f5a623" : "#334155" }}>
                          {total > 0 ? total : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

        </>
      )}

      {activeTab === "por-filial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={lightCardStyle}>
            <h3 style={lightTitleStyle}>Headcount por Filial / Obra</h3>
            {branchRows.length === 0 ? (
              <p style={emptyStateStyle}>Não foi encontrada uma coluna de Filial ou Obra para agrupamento.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis type="category" dataKey="filial" width={180} tick={{ fill: "#0f172a", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={lightCardStyle}>
            <h3 style={lightTitleStyle}>Detalhe por Filial / Obra</h3>
            {branchRows.length === 0 ? (
              <p style={emptyStateStyle}>Nenhum agrupamento disponível para os filtros selecionados.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={lightThStyle}>Filial/Obra</th>
                      <th style={{ ...lightThStyle, textAlign: "right" }}>Funcionários</th>
                      <th style={{ ...lightThStyle, textAlign: "right" }}>% do Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchRows.map((row) => (
                      <tr key={row.filial}>
                        <td style={lightTdStyle}>{row.filial}</td>
                        <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.funcionarios.toLocaleString("pt-BR")}</td>
                        <td style={{ ...lightTdStyle, textAlign: "right" }}>{row.percentage.toLocaleString("pt-BR")}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "evolucao" && (
        <div style={lightCardStyle}>
          <h3 style={lightTitleStyle}>Evolução do Headcount</h3>
          {evolutionData.length < 2 ? (
            <p style={emptyStateStyle}>Não foi encontrada uma coluna de data/competência para evolução.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px" }} />
                <Line type="monotone" dataKey="funcionarios" stroke="#0b4f3a" strokeWidth={3} dot={{ r: 4, fill: "#0b4f3a" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === "detalhamento" && (
        <div style={lightCardStyle}>
          <h3 style={lightTitleStyle}>Detalhamento dos Registros do ERP</h3>
          {sortedDetailRows.length === 0 ? (
            <p style={emptyStateStyle}>Nenhum registro encontrado para detalhamento.</p>
          ) : (
            <>
              <div style={{ overflowX: "auto", maxHeight: 520 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {[
                        ["filial", "Filial/Obra"],
                        ["fornecedor", "Fornecedor"],
                        ["cargo", "Cargo/Função"],
                        ["periodo", "Período"],
                        ["dia", "Dia"],
                        ["quantidade", "Qtd"],
                      ].map(([key, label]) => (
                        <th key={key} style={lightThStyle}>
                          <button type="button" onClick={() => setSort(key as DetailSortKey)} style={sortButtonStyle}>
                            {label}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDetailRows.slice(0, 500).map((row, index) => (
                      <tr key={`${row.filial}-${row.fornecedor}-${row.cargo}-${row.periodo}-${row.dia}-${index}`}>
                        <td style={lightTdStyle}>{row.filial}</td>
                        <td style={lightTdStyle}>{row.fornecedor}</td>
                        <td style={lightTdStyle}>{row.cargo}</td>
                        <td style={lightTdStyle}>{row.periodo}</td>
                        <td style={lightTdStyle}>{row.dia}</td>
                        <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedDetailRows.length > 500 && (
                <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 12 }}>
                  Exibindo os primeiros 500 registros de {sortedDetailRows.length.toLocaleString("pt-BR")}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid var(--erp-border)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--erp-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid rgba(51,65,85,0.4)",
  color: "var(--erp-text)",
}

const selectStyle: React.CSSProperties = {
  background: "var(--erp-card)",
  border: "1px solid var(--erp-border)",
  borderRadius: 8,
  color: "var(--erp-text)",
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
}

const filterSelectStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 10px",
  fontSize: 12,
}

const lightCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const lightTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const kpiCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: "16px 20px",
  flex: 1,
  minWidth: 140,
}

const kpiLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 800,
}

const kpiValueStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 28,
  fontWeight: 800,
  color: "#0b4f3a",
}

const lightThStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  whiteSpace: "nowrap",
}

const lightTdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
}

const emptyStateStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
}

const sortButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "inherit",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
}
