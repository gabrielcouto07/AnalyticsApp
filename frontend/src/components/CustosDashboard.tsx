import React, { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend,
} from "recharts"
import { templatesApiUrl } from "../api/client"

const COLORS = [
  "#4f8ef7", "#34c97e", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  obra: string; endereco: string; periodo: string
  total_nfs: number; total_valor: number; valor_medio_nf: number
  unique_fornecedores: number; unique_consolidados: number
  data_inicio: string; data_fim: string
  consolidado_atual: { total_nfs: number; total_valor: number }
}
interface FornRank { fornecedor: string; total_valor: number; qtd_nfs: number; pct_total: number }
interface NatBreak { natureza: string; total_valor: number; qtd_nfs: number }
interface PagBreak { metodo: string; total_valor: number; qtd_nfs: number }
interface MonthTL { mes: string; total_valor: number; qtd_nfs: number; fornecedores: number }
interface ConsBreak { consolidado: string; total_valor: number; qtd_nfs: number; fornecedores: number }
interface TopNF { fornecedor: string; nf: string; mapa: string; valor: number; data_vencto: string; cond_pagto: string; consolidado: string }
interface ConsDetail { num: string; fornecedor: string; nf: string; mapa: string; valor: number; data_vencto: string; cond_pagto: string }

interface FullReport {
  summary: Summary
  fornecedor_ranking: FornRank[]
  natureza_breakdown: NatBreak[]
  pagamento_breakdown: PagBreak[]
  monthly_timeline: MonthTL[]
  consolidado_breakdown: ConsBreak[]
  top_nfs: TopNF[]
  consolidado_detail: ConsDetail[]
}

interface TrendData {
  direction: "up" | "down" | "flat" | "unknown"
  strength?: "forte" | "moderada" | "fraca"
}

interface AnomalyData {
  count?: number
  percentage?: number
}

const fmtBRL = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "—"
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.fill || e.color || "#f1f5f9", margin: "2px 0" }}>
          {e.name || e.dataKey}: <strong>{fmtBRL(e.value)}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const CustosDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [report, setReport] = useState<FullReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyData | null>(null)
  const [tab, setTab] = useState<"overview" | "fornecedores" | "consolidado" | "nfs">("overview")
  const [showAllNatureza, setShowAllNatureza] = useState(false)
  const [showAllFornecedores, setShowAllFornecedores] = useState(false)
  const [showAllConsolidado, setShowAllConsolidado] = useState(false)
  const [showAllNfs, setShowAllNfs] = useState(false)

  useEffect(() => {
    setLoading(true)
    setWarnings([])
    Promise.allSettled([
      fetch(templatesApiUrl(`/custos/analysis/${sessionId}`)).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(templatesApiUrl(`/custos/trend/${sessionId}?window=6`)).then(r => r.json()),
      fetch(templatesApiUrl(`/custos/anomalies/${sessionId}?method=iqr`)).then(r => r.json()),
    ])
      .then(([reportRes, trendRes, anomalyRes]) => {
        const nextWarnings: string[] = []
        if (reportRes.status === "fulfilled") {
          setReport(reportRes.value)
        } else {
          setError("Falha ao carregar análise principal de custos.")
        }

        if (trendRes.status === "fulfilled") {
          setTrend(trendRes.value)
        } else {
          nextWarnings.push("Tendência de custos indisponível.")
        }

        if (anomalyRes.status === "fulfilled") {
          setAnomalies(anomalyRes.value)
        } else {
          nextWarnings.push("Detecção de anomalias indisponível.")
        }

        setWarnings(nextWarnings)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94a3b8" }}>Carregando Controle de Custos...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
  if (error || !report) return (
    <div style={{ padding: 24, color: "#fca5a5", background: "rgba(248,113,113,0.1)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)" }}>
      ⚠️ {error || "Nenhum dado encontrado."}
    </div>
  )

  const { summary: s, fornecedor_ranking, natureza_breakdown, pagamento_breakdown, monthly_timeline, consolidado_breakdown, top_nfs, consolidado_detail } = report

  // Chart data
  const fornBarData = fornecedor_ranking.slice(0, 10).map(f => ({ name: f.fornecedor.length > 25 ? f.fornecedor.slice(0, 25) + "…" : f.fornecedor, total: f.total_valor, fullName: f.fornecedor })).reverse()
  const pagPieData = pagamento_breakdown.map((p, i) => ({ name: p.metodo, value: p.total_valor, color: COLORS[i % COLORS.length] }))
  const consBarData = consolidado_breakdown.map((c) => ({ name: `MC ${c.consolidado}`, total: c.total_valor, nfs: c.qtd_nfs }))
  const timelineData = monthly_timeline.map(t => ({ mes: t.mes, valor: t.total_valor, nfs: t.qtd_nfs }))
  const trendArrow = trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→"

  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const lines = [headers.join(","), ...rows.map(r => r.map(cell => {
      const text = String(cell ?? "")
      return text.includes(",") ? `"${text.replaceAll('"', '""')}"` : text
    }).join(","))]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
          📊 Controle de Custos — {s.obra}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          {s.endereco} · {s.data_inicio} → {s.data_fim} · {s.unique_consolidados} consolidados
        </p>
      </div>

      {warnings.length > 0 && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fcd34d", fontSize: 12 }}>
          ⚠️ Algumas análises não foram carregadas: {warnings.join(" ")}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Total NFs", value: s.total_nfs, color: "#4f8ef7", icon: "📄" },
          { label: "Valor Total", value: fmtBRL(s.total_valor), color: "#34c97e", icon: "💰" },
          { label: "Média / NF", value: fmtBRL(s.valor_medio_nf), color: "#f5a623", icon: "📊" },
          { label: "Fornecedores", value: s.unique_fornecedores, color: "#a78bfa", icon: "🏢" },
          { label: "Consolidados", value: s.unique_consolidados, color: "#06b6d4", icon: "📋" },
          { label: "Período Atual", value: fmtBRL(s.consolidado_atual.total_valor), color: "#e05263", icon: "🔴", sub: `${s.consolidado_atual.total_nfs} NFs` },
        ].map(({ label, value, color, icon, sub }) => (
          <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${color}30`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{icon} {label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800, color }}>{value}</p>
            {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>📈 Tendência Mensal</p>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800, color: "#4f8ef7" }}>{trendArrow} {trend?.direction ?? "unknown"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Força: {trend?.strength ?? "n/d"}</p>
        </div>
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>⚠️ Itens Anômalos</p>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800, color: "#e05263" }}>{anomalies?.count ?? 0}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{anomalies?.percentage ?? 0}% do total</p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          { id: "overview" as const, label: "📊 Visão Geral" },
          { id: "fornecedores" as const, label: "🏢 Fornecedores" },
          { id: "consolidado" as const, label: "📋 Consolidado Atual" },
          { id: "nfs" as const, label: "📄 Top NFs" },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: tab === t.id ? "#4f8ef7" : "rgba(30,41,59,0.8)",
            color: tab === t.id ? "#fff" : "#94a3b8",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Overview                                             */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Top 10 Fornecedores */}
            <div style={cardStyle}>
              <h3 style={h3Style}>🏢 Top 10 Fornecedores</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={fornBarData} layout="vertical" margin={{ left: 0, right: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#f1f5f9", fontSize: 10 }} width={160} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {fornBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pagamento Pie */}
            <div style={cardStyle}>
              <h3 style={h3Style}>💳 Método de Pagamento</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pagPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    label={({ name, value }) => `${name}: ${fmtBRL(value)}`} labelLine={false}>
                    {pagPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmtBRL(Number(value))} />
                </PieChart>
              </ResponsiveContainer>

              <h3 style={{ ...h3Style, marginTop: 24 }}>📋 Valor por Consolidado</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={consBarData} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Timeline */}
          {timelineData.length > 0 && (
            <div style={cardStyle}>
              <h3 style={h3Style}>📈 Evolução Mensal</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timelineData} margin={{ left: 0, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="valor" stroke="#4f8ef7" strokeWidth={3} dot={{ r: 5, fill: "#4f8ef7" }} name="Valor" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Natureza Table */}
          <div style={cardStyle}>
            <h3 style={h3Style}>🏷️ Distribuição por Natureza / Mapa</h3>
            <button
              onClick={() => downloadCsv(
                `custos_natureza_${sessionId}.csv`,
                ["natureza", "total_valor", "qtd_nfs"],
                natureza_breakdown.map((n) => [n.natureza, n.total_valor, n.qtd_nfs]),
              )}
              style={{ ...tdStyle, marginBottom: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}
            >
              Exportar CSV
            </button>
            <div style={{ overflowX: "auto", maxHeight: 350 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Natureza / Mapa</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Valor Total</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>NFs</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllNatureza ? natureza_breakdown : natureza_breakdown.slice(0, 20)).map((n, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                      <td style={{ ...tdStyle, color: "#f1f5f9" }}>{n.natureza}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#34c97e" }}>{fmtBRL(n.total_valor)}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{n.qtd_nfs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {natureza_breakdown.length > 20 && (
              <button onClick={() => setShowAllNatureza(v => !v)} style={{ ...tdStyle, marginTop: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}>
                {showAllNatureza ? "Recolher" : `Mostrar tudo (${natureza_breakdown.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Fornecedores                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "fornecedores" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>🏢 Ranking Completo de Fornecedores</h3>
          <button
            onClick={() => downloadCsv(
              `custos_fornecedores_${sessionId}.csv`,
              ["fornecedor", "total_valor", "qtd_nfs", "pct_total"],
              fornecedor_ranking.map((f) => [f.fornecedor, f.total_valor, f.qtd_nfs, f.pct_total]),
            )}
            style={{ ...tdStyle, marginBottom: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}
          >
            Exportar CSV
          </button>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Fornecedor</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Valor Total</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>NFs</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>% Total</th>
                </tr>
              </thead>
              <tbody>
                {(showAllFornecedores ? fornecedor_ranking : fornecedor_ranking.slice(0, 20)).map((f, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: "#64748b" }}>{i + 1}</td>
                    <td style={{ ...tdStyle, color: "#f1f5f9", fontWeight: 600 }}>{f.fornecedor}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: COLORS[i % COLORS.length] }}>{fmtBRL(f.total_valor)}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{f.qtd_nfs}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "#94a3b8" }}>{f.pct_total}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fornecedor_ranking.length > 20 && (
            <button onClick={() => setShowAllFornecedores(v => !v)} style={{ ...tdStyle, marginTop: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}>
              {showAllFornecedores ? "Recolher" : `Mostrar tudo (${fornecedor_ranking.length})`}
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Consolidado Atual                                    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "consolidado" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>📋 Consolidado Atual — {consolidado_detail.length} NFs — {fmtBRL(s.consolidado_atual.total_valor)}</h3>
          <button
            onClick={() => downloadCsv(
              `custos_consolidado_${sessionId}.csv`,
              ["num", "fornecedor", "nf", "mapa", "cond_pagto", "data_vencto", "valor"],
              consolidado_detail.map((c) => [c.num, c.fornecedor, c.nf, c.mapa, c.cond_pagto, c.data_vencto, c.valor]),
            )}
            style={{ ...tdStyle, marginBottom: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}
          >
            Exportar CSV
          </button>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Fornecedor</th>
                  <th style={thStyle}>NF</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Mapa</th>
                  <th style={thStyle}>Pagto</th>
                  <th style={thStyle}>Vencto</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(showAllConsolidado ? consolidado_detail : consolidado_detail.slice(0, 25)).map((c, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#64748b" }}>{c.num}</td>
                    <td style={{ ...tdStyle, color: "#f1f5f9", fontWeight: 600 }}>{c.fornecedor}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{c.nf}</td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 11 }}>{c.mapa}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: c.cond_pagto.includes("BOLETO") ? "rgba(52,201,126,0.15)" : "rgba(79,142,247,0.15)",
                        color: c.cond_pagto.includes("BOLETO") ? "#34c97e" : "#4f8ef7",
                      }}>{c.cond_pagto}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{c.data_vencto}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#34c97e" }}>{fmtBRL(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #334155" }}>
                  <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, color: "#f1f5f9" }}>TOTAL</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#f5a623", fontSize: 14 }}>
                    {fmtBRL(s.consolidado_atual.total_valor)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {consolidado_detail.length > 25 && (
            <button onClick={() => setShowAllConsolidado(v => !v)} style={{ ...tdStyle, marginTop: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}>
              {showAllConsolidado ? "Recolher" : `Mostrar tudo (${consolidado_detail.length})`}
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Top NFs                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "nfs" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>📄 Top 20 Maiores NFs</h3>
          <button
            onClick={() => downloadCsv(
              `custos_top_nfs_${sessionId}.csv`,
              ["fornecedor", "nf", "mapa", "consolidado", "cond_pagto", "data_vencto", "valor"],
              top_nfs.map((nf) => [nf.fornecedor, nf.nf, nf.mapa, nf.consolidado, nf.cond_pagto, nf.data_vencto, nf.valor]),
            )}
            style={{ ...tdStyle, marginBottom: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}
          >
            Exportar CSV
          </button>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Fornecedor</th>
                  <th style={thStyle}>NF</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Mapa</th>
                  <th style={thStyle}>MC</th>
                  <th style={thStyle}>Pagto</th>
                  <th style={thStyle}>Vencto</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(showAllNfs ? top_nfs : top_nfs.slice(0, 20)).map((nf, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, color: "#f1f5f9", fontWeight: 600, maxWidth: 200 }}>{nf.fornecedor}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{nf.nf}</td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 11, maxWidth: 150 }}>{nf.mapa}</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#06b6d4" }}>{nf.consolidado}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: nf.cond_pagto.includes("BOLETO") ? "rgba(52,201,126,0.15)" : "rgba(79,142,247,0.15)",
                        color: nf.cond_pagto.includes("BOLETO") ? "#34c97e" : "#4f8ef7",
                      }}>{nf.cond_pagto}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{nf.data_vencto}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: i < 3 ? "#e05263" : "#34c97e" }}>
                      {fmtBRL(nf.valor)}
                      {(anomalies?.count ?? 0) > 0 && i < 3 ? <span style={{ marginLeft: 6, color: "#fca5a5" }}>⚠️</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {top_nfs.length > 20 && (
            <button onClick={() => setShowAllNfs(v => !v)} style={{ ...tdStyle, marginTop: 10, borderRadius: 8, border: "1px solid #334155", cursor: "pointer", fontWeight: 700 }}>
              {showAllNfs ? "Recolher" : `Mostrar tudo (${top_nfs.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = { background: "rgba(30,41,59,0.7)", border: "1px solid var(--erp-border)", borderRadius: 14, padding: "20px 24px" }
const h3Style: React.CSSProperties = { margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--erp-text)" }
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 }
const thStyle: React.CSSProperties = { textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--erp-border)", fontSize: 11, fontWeight: 700, color: "var(--erp-muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }
const tdStyle: React.CSSProperties = { padding: "7px 12px", borderBottom: "1px solid rgba(51,65,85,0.4)", color: "var(--erp-text)" }
