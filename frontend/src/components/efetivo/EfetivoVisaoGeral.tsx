import React, { useEffect, useMemo, useState } from "react"

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { useSessionStore } from "../../store/session"
import { buildBranchRows, buildWorkRows, fetchEfetivoBase } from "./data"

const SERIES_COLORS = [
  "#4f8ef7",
  "#34c97e",
  "#f5a623",
  "#e05263",
  "#a78bfa",
  "#06b6d4",
  "#f97316",
  "#ec4899",
]

function trendArrow(trend: EfetivoTrendResponse | null) {
  if (!trend || trend.direction === "unknown") return "→"
  if (trend.direction === "up") return trend.strength === "forte" ? "↑" : "↗"
  if (trend.direction === "down") return trend.strength === "forte" ? "↓" : "↘"
  return "→"
}

function VisaoGeralSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} style={skeletonCardStyle} />
        ))}
      </div>
      <div style={panelSkeletonStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
  const [activeMes, setActiveMes] = useState<number | null>(null)
  const [hiddenFornecedores, setHiddenFornecedores] = useState<string[]>([])
  const [trendTotal, setTrendTotal] = useState<EfetivoTrendResponse | null>(null)
  const [trendMedia, setTrendMedia] = useState<EfetivoTrendResponse | null>(null)
  const [anomalyDays, setAnomalyDays] = useState<number[]>([])
  const [summaryText, setSummaryText] = useState({
    obra: "",
    totalDiarias: 0,
    diasAtivos: 0,
    mediaDiaria: 0,
    fornecedores: 0,
    funcoes: 0,
    mesesCobertos: 0,
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchEfetivoBase(sessionId),
      fetchApiJson<EfetivoTrendResponse>(
        `/api/templates/efetivo/trend/${sessionId}?column=total_trabalhadores&window=7`,
      ),
      fetchApiJson<EfetivoTrendResponse>(
        `/api/templates/efetivo/trend/${sessionId}?column=fornecedores&window=7`,
      ),
      fetchApiJson<EfetivoAnomaliesResponse>(`/api/templates/efetivo/anomalies/${sessionId}?method=iqr`),
    ])
      .then(([base, totalTrend, mediaTrend, anomalies]) => {
        if (!active) return
        setMonths(base.months)
        setActiveMes(base.months[0]?.mes ?? null)
        setTrendTotal(totalTrend)
        setTrendMedia(mediaTrend)
        setSummaryText({
          obra: base.summary?.obra ?? "",
          totalDiarias: base.summary?.total_diarias ?? 0,
          diasAtivos: base.summary?.dias_ativos ?? 0,
          mediaDiaria: base.summary?.media_diaria ?? 0,
          fornecedores: base.summary?.unique_fornecedores ?? 0,
          funcoes: base.summary?.unique_funcoes ?? 0,
          mesesCobertos: base.summary?.meses_cobertos ?? 0,
        })
        const days = (anomalies.points ?? [])
          .map((point) => new Date(point.data).getDate())
          .filter((value) => !Number.isNaN(value))
        setAnomalyDays(days)
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar a visão geral do efetivo.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const workRows = useMemo(
    () =>
      buildWorkRows(
        summaryText.obra
          ? {
              total_diarias: summaryText.totalDiarias,
              unique_fornecedores: summaryText.fornecedores,
              unique_funcoes: summaryText.funcoes,
              dias_ativos: summaryText.diasAtivos,
              media_diaria: summaryText.mediaDiaria,
              obra: summaryText.obra,
              ano: 0,
              meses_cobertos: summaryText.mesesCobertos,
              data_quality: { fornecedores: [], funcoes: [] },
            }
          : null,
        months,
      ),
    [months, summaryText],
  )

  const currentMonth = months.find((month) => month.mes === activeMes) ?? months[0] ?? null
  const branchRows = useMemo(() => buildBranchRows(workRows), [workRows])
  const periodChart = useMemo(
    () =>
      months.map((month) => ({
        periodo: month.mes_nome,
        total: (month.funcao_detail ?? []).reduce((sum, row) => sum + Number(row.quantidade || 0), 0),
      })),
    [months],
  )

  const fornecedorSeries = useMemo(() => {
    if (!currentMonth) return []
    return (currentMonth.fornecedores ?? []).filter((fornecedor) => !hiddenFornecedores.includes(fornecedor))
  }, [currentMonth, hiddenFornecedores])

  if (loading) return <VisaoGeralSkeleton />

  if (error || !currentMonth) {
    return (
      <EmptyState
        schemaRequired="efetivo"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.efetivo}
        uploadedSchemas={uploadedSchemas}
      />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Total Diárias", value: summaryText.totalDiarias.toLocaleString("pt-BR"), accent: "#4f8ef7", hint: trendArrow(trendTotal) },
          { label: "Dias Ativos", value: summaryText.diasAtivos.toLocaleString("pt-BR"), accent: "#34c97e" },
          { label: "Média Diária", value: summaryText.mediaDiaria.toLocaleString("pt-BR"), accent: "#f5a623", hint: trendArrow(trendMedia) },
          { label: "Fornecedores", value: summaryText.fornecedores.toLocaleString("pt-BR"), accent: "#a78bfa" },
          { label: "Funções", value: summaryText.funcoes.toLocaleString("pt-BR"), accent: "#06b6d4" },
        ].map((card) => (
          <div key={card.label} style={darkCardStyle}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              {card.label} {card.hint ?? ""}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color: card.accent }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={lightPanelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h3 style={lightTitleStyle}>Headcount Diário por Fornecedor</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
              {summaryText.obra || "Obra não identificada"} • {currentMonth.mes_nome}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {months.map((month) => (
              <button
                key={month.mes}
                type="button"
                onClick={() => setActiveMes(month.mes)}
                style={{
                  border: "1px solid rgba(11,79,58,0.16)",
                  borderRadius: 999,
                  background: activeMes === month.mes ? "#0b4f3a" : "#fff",
                  color: activeMes === month.mes ? "#fff" : "#0f172a",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {month.mes_nome}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={currentMonth.daily_pivot}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="Dia" tick={{ fill: "#475569", fontSize: 12 }} />
            <YAxis tick={{ fill: "#475569", fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            {fornecedorSeries.map((fornecedor, index) => (
              <Line
                key={fornecedor}
                type="monotone"
                dataKey={fornecedor}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
            {anomalyDays.map((day, index) => (
              <ReferenceDot key={`${day}-${index}`} x={day} y={0} r={4} fill="#ef4444" stroke="#ef4444" />
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
                onClick={() =>
                  setHiddenFornecedores((current) =>
                    hidden ? current.filter((item) => item !== fornecedor) : [...current, fornecedor],
                  )
                }
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
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: SERIES_COLORS[index % SERIES_COLORS.length],
                    marginRight: 6,
                  }}
                />
                {fornecedor}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={lightPanelStyle}>
          <h3 style={lightTitleStyle}>Headcount por Filial / Obra</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branchRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="filial" tick={{ fill: "#475569", fontSize: 12 }} />
              <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section style={lightPanelStyle}>
          <h3 style={lightTitleStyle}>Períodos Cobertos</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={periodChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodo" tick={{ fill: "#475569", fontSize: 12 }} />
              <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#4f8ef7" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  )
}

const darkCardStyle: React.CSSProperties = {
  background: "rgba(30,41,59,0.7)",
  border: "1px solid rgba(79,142,247,0.12)",
  borderRadius: 12,
  padding: "16px 18px",
}

const lightPanelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
}

const lightTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const skeletonStyle = `
  @keyframes efetivo-skeleton-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const skeletonCardStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "efetivo-skeleton-wave 1.4s ease infinite",
}

const panelSkeletonStyle: React.CSSProperties = {
  ...skeletonCardStyle,
  height: 300,
}
