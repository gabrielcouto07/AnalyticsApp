import React, { useEffect, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts"

import { api } from "../api/client"
import { DashboardLayout, Card, KPIGrid, Section } from "./DashboardLayout"

const API = api.defaults.baseURL

const COLORS = [
  "#4f8ef7", "#34c97e", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]

interface Summary {
  total_diarias: number
  unique_fornecedores: number
  unique_funcoes: number
  dias_ativos: number
  media_diaria: number
  obra: string
  ano: number
  meses_cobertos: number
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0)
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 8, padding: "10px 12px", fontSize: 12,
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

export const EfetivoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [months, setMonths] = useState<MonthData[]>([])
  const [activeMes, setActiveMes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterForn, setFilterForn] = useState<string>("all")
  const [filterFuncao, setFilterFuncao] = useState<string>("all")

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
        setError(`Erro ao carregar dados: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  if (loading) {
    return (
      <DashboardLayout title="Carregando..." description="Aguarde...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "#94a3b8" }}>Carregando dados do Efetivo...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout title="Erro">
        <Card>
          <div style={{ padding: "16px", backgroundColor: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.3)", borderRadius: "8px", color: "#fca5a5" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ {error}</div>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  const validMonths = Array.isArray(months) ? months : []
  if (validMonths.length === 0 || !summary) {
    return (
      <DashboardLayout title="Nenhum dado de Efetivo" description="Estrutura não detectada">
        <Card>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#f1f5f9", marginBottom: "12px" }}>
              Nenhum dado de Efetivo disponível
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
              O arquivo carregado não possui a estrutura esperada de "Controle de Efetivo".
              Verifique se o arquivo contém as colunas necessárias.
            </p>
            <div style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", borderLeft: "3px solid #3b82f6", padding: "12px", borderRadius: "6px", fontSize: "13px", color: "#93c5fd" }}>
              💡 Use a planilha de Controle de Efetivo com a estrutura padrão
            </div>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  const currentMonth = validMonths.find(m => m.mes === activeMes) || validMonths[0]
  const fornecedores = currentMonth?.fornecedores || []
  const allFuncoes = Array.from(new Set(currentMonth?.funcao_detail.map(r => r.funcao) || []))
  const allFornecedores = Array.from(new Set(currentMonth?.funcao_detail.map(r => r.fornecedor) || []))

  // Filter funcao_detail
  const filteredFuncoes = currentMonth?.funcao_detail.filter(r => {
    if (filterForn !== "all" && r.fornecedor !== filterForn) return false
    if (filterFuncao !== "all" && r.funcao !== filterFuncao) return false
    return true
  }) || []

  const grandMedia = summary?.media_diaria || 0

  return (
    <DashboardLayout
      title="🏗️ Controle de Efetivo"
      description={`${summary?.obra} • ${summary?.ano} • ${validMonths.length} mês(es)`}
    >
      {/* KPIs */}
      <Card>
        <KPIGrid
          items={[
            { label: "Total Diárias", value: summary?.total_diarias.toLocaleString("pt-BR"), icon: "📋" },
            { label: "Dias Ativos", value: summary?.dias_ativos, icon: "📅" },
            { label: "Média Diária", value: summary?.media_diaria.toFixed(1), icon: "📊" },
            { label: "Fornecedores", value: summary?.unique_fornecedores, icon: "🏢" },
          ]}
        />
      </Card>

      {/* Month Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {validMonths.map(m => (
          <button
            key={m.mes}
            onClick={() => {
              setActiveMes(m.mes)
              setFilterForn("all")
              setFilterFuncao("all")
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: activeMes === m.mes ? "2px solid #4f8ef7" : "1px solid #334155",
              backgroundColor: activeMes === m.mes ? "rgba(79, 142, 247, 0.15)" : "transparent",
              color: activeMes === m.mes ? "#4f8ef7" : "#94a3b8",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: activeMes === m.mes ? "600" : "500",
              transition: "all 0.2s ease"
            }}
          >
            {m.mes_nome}
          </button>
        ))}
      </div>

      {currentMonth && (
        <>
          {/* Chart */}
          <Card title="📈 Serviços Presentes por Dia" description={`Trabalhadores por dia - ${currentMonth.mes_nome}`}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={currentMonth.daily_pivot} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="Dia" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                <ReferenceLine
                  y={grandMedia}
                  stroke="#475569"
                  strokeDasharray="5 5"
                  label={{ value: `Média: ${grandMedia.toFixed(1)}`, fill: "#94a3b8", fontSize: 11, position: "right" }}
                />
                {fornecedores.map((forn, i) => (
                  <Line
                    key={forn}
                    type="monotone"
                    dataKey={forn}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Services Table */}
          <Card
            title="👷 Serviços Detalhados"
            description={`Funções presentes em cada dia - ${currentMonth.mes_nome}`}
          >
            <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <select
                value={filterForn}
                onChange={e => setFilterForn(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#0f172a",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <option value="all">Todos fornecedores ({allFornecedores.length})</option>
                {allFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              <select
                value={filterFuncao}
                onChange={e => setFilterFuncao(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#0f172a",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <option value="all">Todas funções ({allFuncoes.length})</option>
                {allFuncoes.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {filteredFuncoes.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                Nenhum dado para os filtros selecionados
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "rgba(79, 142, 247, 0.05)", borderBottom: "2px solid #334155" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Dia</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Fornecedor</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Função</th>
                      <th style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#94a3b8" }}>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFuncoes.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #334155",
                          backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(30, 41, 59, 0.3)"
                        }}
                      >
                        <td style={{ padding: "12px", color: "#e2e8f0" }}>{row.dia}</td>
                        <td style={{ padding: "12px", color: "#cbd5e1" }}>{row.fornecedor}</td>
                        <td style={{ padding: "12px", color: "#cbd5e1" }}>{row.funcao}</td>
                        <td style={{ padding: "12px", textAlign: "right", color: "#4f8ef7", fontWeight: "600" }}>
                          {row.quantidade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg) }
        }
      `}</style>
    </DashboardLayout>
  )
}
