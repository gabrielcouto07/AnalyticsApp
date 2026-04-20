import React, { useEffect, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"

import { api } from "../api/client"

const API = api.defaults.baseURL

const COLORS = [
  "#4f8ef7", "#34c97e", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]

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
  const [activeMes, setActiveMes]       = useState<number | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [filterForn, setFilterForn]     = useState<string>("all")
  const [filterFuncao, setFilterFuncao] = useState<string>("all")
  const [isServicosTableCollapsed, setIsServicosTableCollapsed] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [analysisRes, monthlyRes] = await Promise.all([
          fetch(`${API}/api/templates/efetivo/analysis/${sessionId}`).then(r => r.json()),
          fetch(`${API}/api/templates/efetivo/monthly-breakdown/${sessionId}`).then(r => r.json()),
        ])
        setSummary(analysisRes.summary)
        const monthsData = Array.isArray(monthlyRes) ? monthlyRes : []
        setMonths(monthsData)
        if (monthsData.length > 0) setActiveMes(monthsData[0].mes)
      } catch (err) {
        setError(`Erro ao carregar dados do Efetivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94a3b8", fontSize: 14 }}>Carregando Controle de Efetivo...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ padding: "24px", margin: "16px 0", color: "#fca5a5", background: "rgba(248,113,113,0.1)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)", fontSize: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ Erro ao carregar Efetivo</div>
      <div style={{ fontSize: 13, color: "#f5a5a5" }}>{error}</div>
    </div>
  )

  // Ensure months is always an array before using it
  const validMonths = Array.isArray(months) ? months : []
  if (validMonths.length === 0) return (
    <div style={{ minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "500px", textAlign: "center", padding: "32px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 16 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📋</div>
        <h3 style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Nenhum dado de Efetivo disponível</h3>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
          O arquivo carregado não possui a estrutura esperada de "Controle de Efetivo". 
          Verifique se o arquivo foi carregado corretamente e contém as colunas necessárias (Mês, Fornecedor, Função, Quantidade).
        </p>
        <div style={{ marginTop: 20, padding: 12, background: "rgba(59,130,246,0.1)", borderLeft: "3px solid #3b82f6", borderRadius: 4, fontSize: 12, color: "#93c5fd", textAlign: "left" }}>
          💡 Dica: Use a planilha de "Controle de Efetivo" do Excel com a estrutura padrão.
        </div>
      </div>
    </div>
  )

  const currentMonth = validMonths.find(m => m.mes === activeMes) ?? validMonths[0]
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
          🏗️ Controle de Efetivo — {summary?.obra}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          {summary?.ano} · {summary?.meses_cobertos} {summary?.meses_cobertos === 1 ? "mês" : "meses"} · {summary?.unique_fornecedores} fornecedores · {summary?.unique_funcoes} funções
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Diárias", value: summary?.total_diarias.toLocaleString("pt-BR"), color: "#4f8ef7", icon: "📋" },
          { label: "Dias Ativos",   value: summary?.dias_ativos,                           color: "#34c97e", icon: "📅" },
          { label: "Média Diária",  value: summary?.media_diaria,                          color: "#f5a623", icon: "📊" },
          { label: "Fornecedores",  value: summary?.unique_fornecedores,                   color: "#a78bfa", icon: "🏢" },
          { label: "Funções",       value: summary?.unique_funcoes,                        color: "#06b6d4", icon: "👷" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${color}30`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{icon} {label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color }}>{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* ── Month Tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {validMonths.map(m => (
          <button
            key={m.mes}
            onClick={() => { setActiveMes(m.mes); setFilterForn("all"); setFilterFuncao("all") }}
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
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                <ReferenceLine y={grandMedia} stroke="#475569" strokeDasharray="5 5"
                  label={{ value: `Média geral: ${grandMedia}`, fill: "#64748b", fontSize: 10, position: "right" }} />
                {fornecedores.map((forn, i) => (
                  <Line key={forn} type="monotone" dataKey={forn}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Serviços por Dia (funções) ────────────────────────────── */}
          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: isServicosTableCollapsed ? 0 : 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => setIsServicosTableCollapsed(!isServicosTableCollapsed)}
                  style={{
                    background: "transparent",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px 10px",
                    fontSize: 14,
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 32,
                    minHeight: 32,
                  }}
                  title={isServicosTableCollapsed ? "Expandir tabela" : "Encolher tabela"}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(148, 163, 184, 0.1)"
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8"
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent"
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#475569"
                  }}
                >
                  {isServicosTableCollapsed ? "▸" : "▾"}
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                    👷 Serviços por Dia — {currentMonth.mes_nome}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                    Quais funções estavam presentes em cada dia
                  </p>
                </div>
              </div>
              {!isServicosTableCollapsed && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={filterForn} onChange={e => setFilterForn(e.target.value)} style={selectStyle}>
                    <option value="all">Todos fornecedores</option>
                    {allFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={filterFuncao} onChange={e => setFilterFuncao(e.target.value)} style={selectStyle}>
                    <option value="all">Todas funções</option>
                    {allFuncoes.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
            </div>

            {!isServicosTableCollapsed && (
              <>
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
                        {dias.map(dia =>
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
              </>
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
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left",
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

const selectStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
}
