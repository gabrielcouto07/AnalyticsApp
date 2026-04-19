import React, { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend,
} from "recharts"

const API = "http://localhost:8001/api/templates"

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
  const [tab, setTab] = useState<"overview" | "fornecedores" | "consolidado" | "nfs">("overview")

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/custos/analysis/${sessionId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setReport)
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
  const consBarData = consolidado_breakdown.map((c, i) => ({ name: `MC ${c.consolidado}`, total: c.total_valor, nfs: c.qtd_nfs }))
  const timelineData = monthly_timeline.map(t => ({ mes: t.mes, valor: t.total_valor, nfs: t.qtd_nfs }))

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
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
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
                  {natureza_breakdown.slice(0, 20).map((n, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                      <td style={{ ...tdStyle, color: "#f1f5f9" }}>{n.natureza}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#34c97e" }}>{fmtBRL(n.total_valor)}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{n.qtd_nfs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Fornecedores                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "fornecedores" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>🏢 Ranking Completo de Fornecedores</h3>
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
                {fornecedor_ranking.map((f, i) => (
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Consolidado Atual                                    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "consolidado" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>📋 Consolidado Atual — {consolidado_detail.length} NFs — {fmtBRL(s.consolidado_atual.total_valor)}</h3>
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
                {consolidado_detail.map((c, i) => (
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Top NFs                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "nfs" && (
        <div style={cardStyle}>
          <h3 style={h3Style}>📄 Top 20 Maiores NFs</h3>
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
                {top_nfs.map((nf, i) => (
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
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: i < 3 ? "#e05263" : "#34c97e" }}>{fmtBRL(nf.valor)}</td>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = { background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }
const h3Style: React.CSSProperties = { margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 }
const thStyle: React.CSSProperties = { textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #334155", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }
const tdStyle: React.CSSProperties = { padding: "7px 12px", borderBottom: "1px solid rgba(51,65,85,0.4)", color: "#f1f5f9" }
