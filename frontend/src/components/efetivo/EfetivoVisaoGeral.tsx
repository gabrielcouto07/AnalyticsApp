import React, { useEffect, useMemo, useState } from "react"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  fetchApiJson,
  type EfetivoAnomaliesResponse,
  type EfetivoMonthData,
  type EfetivoTrendResponse,
} from "../../api/analytics"
import { formatDiarias, formatInt, formatPct } from "../../lib/formatters"
import { useSessionStore } from "../../store/session"
import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { buildBranchRows, buildCompleteness, buildEvolutionData, buildWorkRows, fetchEfetivoBase } from "./data"

const SERIES_COLORS = ["#1a5c45", "#2d8659", "#4ab07a", "#7ecba1", "#c4e8d3", "#f0a500", "#e05c1a", "#8b1a4a"]

function trendArrow(trend: EfetivoTrendResponse | null) {
  if (!trend || trend.direction === "unknown" || trend.direction === "flat") return "→"
  if (trend.direction === "up") return trend.strength === "forte" ? "↑" : "↗"
  if (trend.direction === "down") return trend.strength === "forte" ? "↓" : "↘"
  return "→"
}

function readSummaryNumber(summary: Awaited<ReturnType<typeof fetchEfetivoBase>>["summary"], key: string) {
  if (!summary) return undefined
  const value = (summary as unknown as Record<string, unknown>)[key]
  return typeof value === "number" ? value : undefined
}

function sumDailyValues(row: Record<string, string | number | null | undefined>, fornecedores: string[]) {
  return fornecedores.reduce((sum, fornecedor) => sum + (typeof row[fornecedor] === "number" ? Number(row[fornecedor]) : 0), 0)
}

function maxDailyValue(row: Record<string, string | number | null | undefined>, fornecedores: string[]) {
  return fornecedores.reduce(
    (maxValue, fornecedor) => (typeof row[fornecedor] === "number" ? Math.max(maxValue, Number(row[fornecedor])) : maxValue),
    0,
  )
}

function VisaoGeralSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
      <div style={{ ...panelSkeletonStyle, height: 420 }} />
      <div style={panelSkeletonStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <div style={panelSkeletonStyle} />
        <div style={panelSkeletonStyle} />
      </div>
      <div style={panelSkeletonStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <div style={panelSkeletonStyle} />
        <div style={panelSkeletonStyle} />
      </div>
      <style>{skeletonStyle}</style>
    </div>
  )
}

export function EfetivoVisaoGeral({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [months, setMonths] = useState<EfetivoMonthData[]>([])
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchEfetivoBase>>["summary"]>(null)
  const [activeMes, setActiveMes] = useState<number | null>(null)
  const [hiddenFornecedores, setHiddenFornecedores] = useState<string[]>([])
  const [trendTotal, setTrendTotal] = useState<EfetivoTrendResponse | null>(null)
  const [trendMedia, setTrendMedia] = useState<EfetivoTrendResponse | null>(null)
  const [anomalyDays, setAnomalyDays] = useState<number[]>([])
  const [workforceSummary, setWorkforceSummary] = useState<Array<Record<string, unknown>>>([])
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchEfetivoBase(sessionId),
      fetchApiJson<EfetivoTrendResponse>(`/api/templates/efetivo/trend/${sessionId}?column=total_trabalhadores&window=7`),
      fetchApiJson<EfetivoTrendResponse>(`/api/templates/efetivo/trend/${sessionId}?column=fornecedores&window=7`),
      fetchApiJson<EfetivoAnomaliesResponse>(`/api/templates/efetivo/anomalies/${sessionId}?method=iqr`),
      fetchApiJson<Array<Record<string, unknown>>>(`/api/analytics/${sessionId}/workforce-summary`).catch(() => []),
      fetchApiJson<Record<string, unknown>>(`/api/analytics/${sessionId}/forecast?horizon_months=2`).catch(() => null),
    ])
      .then(([base, totalTrend, mediaTrend, anomalies, nextWorkforceSummary, nextForecast]) => {
        if (!active) return
        setSummary(base.summary)
        setMonths(base.months)
        setActiveMes(base.months[0]?.mes ?? null)
        setHiddenFornecedores([])
        setTrendTotal(totalTrend)
        setTrendMedia(mediaTrend)
        setWorkforceSummary(nextWorkforceSummary)
        setForecast(nextForecast)
        setAnomalyDays(
          (anomalies.points ?? [])
            .map((point) => new Date(point.data).getDate())
            .filter((value) => !Number.isNaN(value)),
        )
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar a visao geral do efetivo.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const workRows = useMemo(() => buildWorkRows(summary, months), [months, summary])
  const branchRows = useMemo(() => buildBranchRows(workRows), [workRows])
  const completeness = useMemo(() => buildCompleteness(workRows), [workRows])
  const totalDiarias = useMemo(() => workRows.reduce((sum, row) => sum + row.quantidade, 0), [workRows])
  const totalFuncionarios = useMemo(
    () => new Set(workRows.filter((row) => row.quantidade > 0).map((row) => `${row.fornecedor}|${row.cargo}`)).size,
    [workRows],
  )
  const obrasAtivas = useMemo(() => new Set(workRows.map((row) => row.filial)).size, [workRows])
  const cargosDistintos = useMemo(() => new Set(workRows.map((row) => row.cargo)).size, [workRows])
  const periodChart = useMemo(
    () =>
      buildEvolutionData(workRows).map((row) => ({
        periodo: row.periodo,
        total: row.funcionarios,
      })),
    [workRows],
  )
  const currentMonth = useMemo(
    () => months.find((month) => month.mes === activeMes) ?? months[0] ?? null,
    [activeMes, months],
  )
  const visibleFornecedores = useMemo(() => {
    if (!currentMonth) return []
    return (currentMonth.fornecedores ?? []).filter((fornecedor) => !hiddenFornecedores.includes(fornecedor))
  }, [currentMonth, hiddenFornecedores])
  const anomalyMarkers = useMemo(() => {
    if (!currentMonth) return []
    return anomalyDays
      .map((day) => {
        const row = currentMonth.daily_pivot.find((dailyRow) => Number(dailyRow.Dia) === day)
        if (!row) return null
        return {
          day,
          y: Math.max(maxDailyValue(row, visibleFornecedores), sumDailyValues(row, currentMonth.fornecedores ?? [])),
        }
      })
      .filter((item): item is { day: number; y: number } => item !== null)
  }, [anomalyDays, currentMonth, visibleFornecedores])
  const cargoChart = useMemo(() => {
    if (!currentMonth) return []
    const grouped = new Map<string, number>()
    for (const row of currentMonth.funcao_detail ?? []) {
      const cargo = row.funcao?.trim() || "Nao informado"
      grouped.set(cargo, (grouped.get(cargo) ?? 0) + Number(row.quantidade || 0))
    }
    return Array.from(grouped.entries())
      .map(([cargo, quantidade]) => ({ cargo, quantidade }))
      .sort((left, right) => right.quantidade - left.quantidade)
      .slice(0, 10)
  }, [currentMonth])
  const fornecedorRanking = useMemo(() => {
    if (!currentMonth) return []
    const grouped = new Map<string, number>()
    for (const row of currentMonth.funcao_detail ?? []) {
      const fornecedor = row.fornecedor?.trim() || "Nao informado"
      grouped.set(fornecedor, (grouped.get(fornecedor) ?? 0) + Number(row.quantidade || 0))
    }
    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0)
    return Array.from(grouped.entries())
      .map(([fornecedor, quantidade]) => ({
        fornecedor,
        quantidade,
        percentual: total > 0 ? (quantidade / total) * 100 : 0,
      }))
      .sort((left, right) => right.quantidade - left.quantidade)
      .slice(0, 5)
  }, [currentMonth])
  const workforceForecastChart = useMemo(() => {
    const historical = workforceSummary.map((row, index) => {
      const total = Number(row.total_worker_days ?? 0)
      const historyValues = workforceSummary.slice(0, index + 1).map((item) => Number(item.total_worker_days ?? 0))
      const movingAverage = historyValues.length > 0 ? historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length : 0
      return {
        label: String(row.mes_nome ?? row.mes ?? ""),
        historico: total,
        forecast: null,
        media: Math.round(movingAverage * 100) / 100,
      }
    })
    const projected = Array.isArray(forecast?.projected_monthly)
      ? forecast.projected_monthly.slice(0, 2).map((row) => ({
          label: `+${String((row as Record<string, unknown>).mes_offset ?? "")}`,
          historico: null,
          forecast: Number((row as Record<string, unknown>).valor_previsto ?? 0),
          media: historical[historical.length - 1]?.media ?? 0,
        }))
      : []
    return [...historical, ...projected]
  }, [forecast, workforceSummary])
  const mediaMensal = useMemo(() => {
    if (workforceSummary.length === 0) return 0
    return workforceSummary.reduce((sum, row) => sum + Number(row.total_worker_days ?? 0), 0) / workforceSummary.length
  }, [workforceSummary])
  const mesPico = useMemo(() => {
    if (workforceSummary.length === 0) return "-"
    return [...workforceSummary].sort((left, right) => Number(right.total_worker_days ?? 0) - Number(left.total_worker_days ?? 0))[0]?.mes_nome?.toString() ?? "-"
  }, [workforceSummary])

  if (loading) return <VisaoGeralSkeleton />

  if (error || workRows.length === 0 || !currentMonth) {
    return <EmptyState schemaRequired="efetivo" requiredColumns={SCHEMA_REQUIRED_COLUMNS.efetivo} uploadedSchemas={uploadedSchemas} />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          {
            label: "TOTAL FUNCIONÁRIOS",
            value: formatInt(readSummaryNumber(summary, "total_funcionarios") ?? totalFuncionarios),
          },
          { label: "OBRAS ATIVAS", value: formatInt(obrasAtivas) },
          { label: "CARGOS DISTINTOS", value: formatInt(cargosDistintos) },
          { label: "% DADOS COMPLETOS", value: formatPct(completeness) },
        ].map((card, index) => (
          <div key={card.label} style={metricCardStyle}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>{card.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: index === 0 ? "#0b4f3a" : "#0f172a" }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "TOTAL DIÁRIAS", value: formatDiarias(summary?.total_diarias ?? totalDiarias), accent: "#4f8ef7", hint: trendArrow(trendTotal) },
          { label: "DIAS ATIVOS", value: formatInt(summary?.dias_ativos ?? 0), accent: "#34c97e" },
          { label: "MÉDIA DIÁRIA", value: formatDiarias(summary?.media_diaria ?? 0), accent: "#f5a623", hint: trendArrow(trendMedia) },
          { label: "FORNECEDORES", value: formatInt(readSummaryNumber(summary, "total_fornecedores") ?? summary?.unique_fornecedores ?? 0), accent: "#a78bfa" },
          { label: "FUNÇÕES", value: formatInt(readSummaryNumber(summary, "total_funcoes") ?? summary?.unique_funcoes ?? 0), accent: "#06b6d4" },
        ].map((card) => (
          <div key={card.label} style={darkCardStyle}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              {card.label} {card.hint ?? ""}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color: card.accent }}>{card.value}</p>
          </div>
        ))}
      </div>

      <section style={lightPanelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h3 style={lightTitleStyle}>Headcount Diario por Fornecedor</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>{(summary?.obra || "Obra nao identificada").trim()} • {currentMonth.mes_nome}</p>
          </div>
          <div style={{ maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none" as "none" }}>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: 4, display: "inline-flex", flexWrap: "nowrap" }}>
              {months.map((month) => {
                const isActive = activeMes === month.mes
                return (
                  <button
                    key={month.mes}
                    type="button"
                    onClick={() => {
                      setActiveMes(month.mes)
                      setHiddenFornecedores([])
                    }}
                    style={{
                      background: isActive ? "#0b4f3a" : "transparent",
                      color: isActive ? "#fff" : "#475569",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {month.mes_nome}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={currentMonth.daily_pivot}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="Dia" tick={{ fill: "#475569", fontSize: 12 }} />
            <YAxis tick={{ fill: "#475569", fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            {visibleFornecedores.map((fornecedor, index) => (
              <Line key={fornecedor} type="monotone" dataKey={fornecedor} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            ))}
            {anomalyMarkers.map((marker, index) => (
              <ReferenceDot key={`${marker.day}-${index}`} x={marker.day} y={marker.y} r={5} fill="#ef4444" stroke="#ef4444" />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {(currentMonth.fornecedores ?? []).map((fornecedor, index) => {
            const hidden = hiddenFornecedores.includes(fornecedor)
            return (
              <button
                key={fornecedor}
                type="button"
                onClick={() => setHiddenFornecedores((current) => (hidden ? current.filter((item) => item !== fornecedor) : [...current, fornecedor]))}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.22)",
                  padding: "6px 10px",
                  background: hidden ? "rgba(148,163,184,0.08)" : "rgba(255,255,255,0.96)",
                  color: hidden ? "#94a3b8" : "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: SERIES_COLORS[index % SERIES_COLORS.length], marginRight: 6 }} />
                {fornecedor}
              </button>
            )
          })}
        </div>
      </section>

      <section style={lightPanelStyle}>
        <h3 style={lightTitleStyle}>Headcount por Periodo</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={periodChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill="#0b4f3a" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <section style={lightPanelStyle}>
          <h3 style={lightTitleStyle}>Distribuicao por Cargo</h3>
          {cargoChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cargoChart} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="cargo" width={220} tick={{ fill: "#0f172a", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={emptyPanelStateStyle}>Sem cargos disponiveis para o mes selecionado.</div>
          )}
        </section>

        <section style={lightPanelStyle}>
          <h3 style={lightTitleStyle}>Top Fornecedores no Mes</h3>
          {fornecedorRanking.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fornecedor</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Diarias</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedorRanking.map((row) => (
                    <tr key={row.fornecedor}>
                      <td style={tdStyle}>{row.fornecedor}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{formatDiarias(row.quantidade)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{formatPct(row.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={emptyPanelStateStyle}>Sem fornecedores disponiveis para o mes selecionado.</div>
          )}
        </section>
      </div>

      <section style={lightPanelStyle}>
        <h3 style={lightTitleStyle}>Headcount por Obra</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={branchRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis type="category" dataKey="obra" width={220} tick={{ fill: "#0f172a", fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={forecastPanelStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 20 }}>
          <div>
            <h3 style={{ ...lightTitleStyle, color: "#f8fafc", marginBottom: 6 }}>Previsao de Demanda de Mao de Obra</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#94a3b8" }}>Historico mensal, forecast para os proximos 2 meses e linha de media movel.</p>
            {workforceForecastChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={workforceForecastChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                  <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="historico" fill="#0b4f3a" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="forecast" fill="rgba(22,163,74,0.18)" stroke="#2f7d6b" radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="media" stroke="#6bb38f" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: "#6bb38f" }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={emptyForecastStateStyle}>Sem historico suficiente para previsao de demanda.</div>
            )}
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={forecastInnerCardStyle}>
              <h4 style={forecastInnerTitleStyle}>Indicadores</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
                <div>
                  <p style={forecastLabelStyle}>Media mensal</p>
                  <p style={forecastValueStyle}>{formatDiarias(mediaMensal)}</p>
                </div>
                <div>
                  <p style={forecastLabelStyle}>Mes pico</p>
                  <p style={forecastValueStyle}>{mesPico}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const skeletonStyle = `
  @keyframes efetivo-visao-geral-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const cardSkeletonStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "efetivo-visao-geral-wave 1.4s ease infinite",
}

const panelSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 300,
}

const metricCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: "16px 20px",
}

const darkCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid rgba(11,79,58,0.10)",
  borderRadius: 12,
  padding: "16px 18px",
}

const lightPanelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const lightTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const emptyPanelStateStyle: React.CSSProperties = {
  minHeight: 220,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  border: "1px dashed rgba(148,163,184,0.35)",
  borderRadius: 12,
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
}

const forecastPanelStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 10px 28px rgba(15,23,42,0.18)",
}

const forecastInnerCardStyle: React.CSSProperties = {
  background: "rgba(30,41,59,0.86)",
  border: "1px solid rgba(11,79,58,0.16)",
  borderRadius: 12,
  padding: "16px 20px",
}

const forecastInnerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#f8fafc",
}

const forecastLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#94a3b8",
}

const forecastValueStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 24,
  fontWeight: 800,
  color: "#f8fafc",
}

const emptyForecastStateStyle: React.CSSProperties = {
  minHeight: 120,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#cbd5e1",
  fontSize: 13,
  border: "1px dashed rgba(148,163,184,0.24)",
  borderRadius: 12,
}
