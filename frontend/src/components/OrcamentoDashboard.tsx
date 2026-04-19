import React, { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts"

const API = "http://localhost:8001/api/templates"

const COLORS = [
  "#34c97e", "#4f8ef7", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]
const WINNER_COLOR = "#34c97e"
const LOSER_COLOR = "#475569"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  obra: string
  assunto: string
  numero: string
  total_items: number
  total_fornecedores: number
  menor_preco_fornecedor: string
  menor_preco_valor: number
  fornecedor_totals: Record<string, number>
  tipo_breakdown: Record<string, number>
  fornecedores_list: string[]
}

interface PricePivotRow {
  item: number
  descricao: string
  quant: number
  unid: string
  tipo: string
  precos: Record<string, number | null>
  cheapest: string | null
  cheapest_preco: number | null
}

interface FornecedorRank {
  fornecedor: string
  total_preco: number
  items_cotados: number
  total_items: number
  cobertura_pct: number
  itens_mais_barato: number
  contato: string
  telefone: string
  email: string
}

interface ItemAnalysis {
  item: number
  descricao: string
  quant: number
  unid: string
  tipo: string
  cotacoes: number
  menor_preco: number | null
  menor_fornecedor: string | null
  maior_preco: number | null
  maior_fornecedor: string | null
  spread: number | null
  spread_pct: number | null
}

interface FullReport {
  summary: Summary
  price_pivot: { items: number[]; fornecedores: string[]; rows: PricePivotRow[] }
  fornecedor_ranking: FornecedorRank[]
  item_analysis: ItemAnalysis[]
  tipo_breakdown: { servicos: number; insumos: number }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtBRL = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "—"
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const fmtPct = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "—"
  return `${n.toFixed(1)}%`
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.fill || e.color || "#94a3b8", margin: "2px 0" }}>
          {fmtBRL(e.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const OrcamentoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [report, setReport] = useState<FullReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"pivot" | "ranking" | "items">("pivot")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API}/orcamento/analysis/${sessionId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setReport(data)
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar dados do Orçamento.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  // ─── Loading / Error ────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#34c97e", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94a3b8" }}>Carregando Mapa de Concorrência...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (error || !report) return (
    <div style={{ padding: 24, color: "#fca5a5", background: "rgba(248,113,113,0.1)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)" }}>
      ⚠️ {error || "Nenhum dado encontrado."}
    </div>
  )

  const { summary, price_pivot, fornecedor_ranking, item_analysis, tipo_breakdown } = report

  // Chart data: fornecedor totals as bar chart
  const fornTotalData = Object.entries(summary.fornecedor_totals)
    .filter(([name]) => name)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => a.total - b.total)

  // Pie data: tipo breakdown
  const tipoPieData = [
    { name: "Serviço", value: tipo_breakdown.servicos, color: "#4f8ef7" },
    { name: "Insumo", value: tipo_breakdown.insumos, color: "#f5a623" },
  ].filter(d => d.value > 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
          💰 Mapa de Concorrência — {summary.assunto}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          {summary.obra} · Nº {summary.numero} · {summary.total_items} itens · {summary.total_fornecedores} fornecedores
        </p>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Itens", value: summary.total_items, color: "#4f8ef7", icon: "📦" },
          { label: "Fornecedores", value: summary.total_fornecedores, color: "#a78bfa", icon: "🏢" },
          { label: "Menor Preço", value: fmtBRL(summary.menor_preco_valor), color: "#34c97e", icon: "🏆", sub: summary.menor_preco_fornecedor },
          { label: "Serviços", value: tipo_breakdown.servicos, color: "#06b6d4", icon: "🔧" },
          { label: "Insumos", value: tipo_breakdown.insumos, color: "#f5a623", icon: "📋" },
        ].map(({ label, value, color, icon, sub }) => (
          <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${color}30`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{icon} {label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, color }}>{value}</p>
            {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Charts Row ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        {/* Bar: Totals per Fornecedor */}
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
            📊 Preço Total por Fornecedor
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(180, fornTotalData.length * 48)}>
            <BarChart data={fornTotalData} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => fmtBRL(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#f1f5f9", fontSize: 11 }} width={180} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} label={{ position: "right", fill: "#94a3b8", fontSize: 11, formatter: (v: number) => fmtBRL(v) }}>
                {fornTotalData.map((entry, i) => (
                  <Cell key={i} fill={entry.name === summary.menor_preco_fornecedor ? WINNER_COLOR : COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: Tipo */}
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
            🔧 Tipo de Item
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={tipoPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {tipoPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        {([
          { id: "pivot" as const, label: "📋 Comparativo de Preços" },
          { id: "ranking" as const, label: "🏆 Ranking Fornecedores" },
          { id: "items" as const, label: "📦 Análise por Item" },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: activeTab === tab.id ? "#4f8ef7" : "rgba(30,41,59,0.8)",
            color: activeTab === tab.id ? "#fff" : "#94a3b8",
            transition: "all 0.15s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Price Comparison Pivot                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "pivot" && (
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
            Comparativo de Preços — Item × Fornecedor
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>
            Células verdes = menor preço para o item
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, minWidth: 200, textAlign: "left" }}>Descrição</th>
                  <th style={thStyle}>Qtd</th>
                  <th style={thStyle}>Tipo</th>
                  {price_pivot.fornecedores.map(f => (
                    <th key={f} style={{ ...thStyle, minWidth: 120, color: "#4f8ef7" }}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {price_pivot.rows.map((row, idx) => (
                  <tr key={row.item} style={{ background: idx % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#64748b", textAlign: "center" }}>{row.item}</td>
                    <td style={{ ...tdStyle, color: "#f1f5f9", maxWidth: 280 }} title={row.descricao}>
                      {row.descricao.length > 55 ? row.descricao.slice(0, 55) + "…" : row.descricao}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{row.quant || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: row.tipo === "Serviço" ? "rgba(79,142,247,0.15)" : "rgba(245,166,35,0.15)",
                        color: row.tipo === "Serviço" ? "#4f8ef7" : "#f5a623",
                      }}>{row.tipo}</span>
                    </td>
                    {price_pivot.fornecedores.map(forn => {
                      const preco = row.precos[forn]
                      const isCheapest = row.cheapest === forn && preco != null
                      return (
                        <td key={forn} style={{
                          ...tdStyle, textAlign: "right", fontWeight: 600,
                          color: preco == null ? "#334155" : isCheapest ? WINNER_COLOR : "#f1f5f9",
                          background: isCheapest ? "rgba(52,201,126,0.08)" : "transparent",
                        }}>
                          {preco != null ? fmtBRL(preco) : "—"}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr style={{ borderTop: "2px solid #334155" }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, color: "#f1f5f9" }}>TOTAL</td>
                  {price_pivot.fornecedores.map(forn => {
                    const total = summary.fornecedor_totals[forn] ?? 0
                    const isWinner = forn === summary.menor_preco_fornecedor
                    return (
                      <td key={forn} style={{
                        ...tdStyle, textAlign: "right", fontWeight: 800, fontSize: 13,
                        color: isWinner ? WINNER_COLOR : "#f5a623",
                        background: isWinner ? "rgba(52,201,126,0.08)" : "transparent",
                      }}>
                        {fmtBRL(total)}
                        {isWinner && <span style={{ marginLeft: 6, fontSize: 14 }}>🏆</span>}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Fornecedor Ranking                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "ranking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {fornecedor_ranking.map((forn, idx) => {
            const isWinner = forn.fornecedor === summary.menor_preco_fornecedor
            const borderColor = isWinner ? WINNER_COLOR : COLORS[idx % COLORS.length]
            return (
              <div key={forn.fornecedor} style={{
                background: "rgba(30,41,59,0.7)", border: `1px solid ${borderColor}40`,
                borderLeft: `4px solid ${borderColor}`, borderRadius: 14, padding: "20px 24px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  {/* Left: name + contact */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{isWinner ? "🏆" : `#${idx + 1}`}</span>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
                        {forn.fornecedor || "(Sem nome)"}
                      </h4>
                      {isWinner && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "rgba(52,201,126,0.15)", color: WINNER_COLOR }}>
                          MENOR PREÇO
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#94a3b8" }}>
                      {forn.contato && <span>👤 {forn.contato}</span>}
                      {forn.telefone && <span>📞 {forn.telefone}</span>}
                      {forn.email && <span>✉️ {forn.email}</span>}
                    </div>
                  </div>
                  {/* Right: total price */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total</p>
                    <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: borderColor }}>
                      {fmtBRL(forn.total_preco)}
                    </p>
                  </div>
                </div>
                {/* Stats row */}
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Itens Cotados", value: `${forn.items_cotados}/${forn.total_items}` },
                    { label: "Cobertura", value: fmtPct(forn.cobertura_pct) },
                    { label: "Itens Mais Barato", value: forn.itens_mais_barato },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(15,23,42,0.4)", borderRadius: 8, padding: "8px 12px" }}>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>{s.label}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: Item Analysis                                        */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "items" && (
        <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
            Análise por Item — Spread de Preços
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#64748b" }}>
            Diferença entre menor e maior cotação por item
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Descrição</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Cotações</th>
                  <th style={{ ...thStyle, color: WINNER_COLOR }}>Menor Preço</th>
                  <th style={thStyle}>Fornecedor</th>
                  <th style={{ ...thStyle, color: "#e05263" }}>Maior Preço</th>
                  <th style={thStyle}>Fornecedor</th>
                  <th style={thStyle}>Spread</th>
                  <th style={thStyle}>Spread %</th>
                </tr>
              </thead>
              <tbody>
                {item_analysis.map((item, idx) => (
                  <tr key={item.item} style={{ background: idx % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: "#64748b" }}>{item.item}</td>
                    <td style={{ ...tdStyle, color: "#f1f5f9" }} title={item.descricao}>
                      {item.descricao.length > 45 ? item.descricao.slice(0, 45) + "…" : item.descricao}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: item.tipo === "Serviço" ? "rgba(79,142,247,0.15)" : "rgba(245,166,35,0.15)",
                        color: item.tipo === "Serviço" ? "#4f8ef7" : "#f5a623",
                      }}>{item.tipo}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>{item.cotacoes}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: WINNER_COLOR }}>
                      {item.menor_preco != null ? fmtBRL(item.menor_preco) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: "#94a3b8" }}>{item.menor_fornecedor || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#e05263" }}>
                      {item.maior_preco != null ? fmtBRL(item.maior_preco) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: "#94a3b8" }}>{item.maior_fornecedor || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#f5a623" }}>
                      {item.spread != null ? fmtBRL(item.spread) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {item.spread_pct != null ? (
                        <span style={{
                          fontWeight: 700,
                          color: item.spread_pct > 50 ? "#e05263" : item.spread_pct > 20 ? "#f5a623" : "#34c97e",
                        }}>
                          {fmtPct(item.spread_pct)}
                        </span>
                      ) : "—"}
                    </td>
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "8px 12px",
  borderBottom: "1px solid #334155",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid rgba(51,65,85,0.4)",
  color: "#f1f5f9",
}
