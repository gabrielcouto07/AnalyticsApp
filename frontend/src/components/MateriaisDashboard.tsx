import React, { useEffect, useState } from "react"
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

import { api } from "../api/client"
import { DashboardLayout, Card, KPIGrid, Section } from "./DashboardLayout"

const API = api.defaults.baseURL

const COLORS = ["#4f8ef7", "#34c97e", "#f5a623", "#e05263", "#a78bfa", "#06b6d4", "#f97316", "#ec4899"]

interface Summary {
  total_quantidade: number
  total_valor: number
  unique_materiais: number
  unique_fornecedores: number
  media_valor_unitario: number
  material_mais_caro: string
  valor_mais_caro: number
}

interface Material {
  material: string
  quantidade: number
  valor_total: number
  valor_unitario: number
  fornecedor: string
  categoria: string
}

interface Fornecedor {
  fornecedor: string
  total_quantidade: number
  total_valor: number
  quantidade_materiais: number
}

interface Categoria {
  categoria: string
  total_quantidade: number
  total_valor: number
  quantidade_materiais: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 8, padding: "10px 12px", fontSize: 12,
    }}>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.color, margin: "2px 0" }}>
          {e.name}: <strong>{e.name.includes("Quantidade") ? e.value : `R$ ${e.value?.toLocaleString('pt-BR')}`}</strong>
        </p>
      ))}
    </div>
  )
}

export const MateriaisDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [materiais, setMateriais] = useState<Material[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategoria, setFilterCategoria] = useState<string>("all")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const analysisRes = await fetch(`${API}/api/templates/materiais/analysis/${sessionId}`).then(r => r.json())
        setSummary(analysisRes.summary)
        setMateriais(analysisRes.materiais || [])
        setFornecedores(analysisRes.fornecedores || [])
        setCategorias(analysisRes.categorias || [])
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
            <p style={{ color: "#94a3b8" }}>Carregando dados de Materiais...</p>
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

  if (!summary || materiais.length === 0) {
    return (
      <DashboardLayout title="Nenhum dado de Materiais" description="Estrutura não detectada">
        <Card>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#f1f5f9", marginBottom: "12px" }}>
              Nenhum dado de Materiais disponível
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
              O arquivo carregado não possui a estrutura esperada de "Gestão de Materiais".
            </p>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  const filteredMateriais = filterCategoria === "all" ? materiais : materiais.filter(m => m.categoria === filterCategoria)
  const allCategorias = ["all", ...Array.from(new Set(materiais.map(m => m.categoria)))]

  return (
    <DashboardLayout
      title="📦 Gestão de Materiais"
      description={`${summary?.unique_materiais} materiais • ${summary?.unique_fornecedores} fornecedores`}
    >
      {/* KPIs */}
      <Card>
        <KPIGrid
          items={[
            { label: "Total Quantidade", value: summary?.total_quantidade, icon: "📊" },
            { label: "Total Valor", value: `R$ ${(summary.total_valor / 1000).toFixed(1)}K`, icon: "💰" },
            { label: "Fornecedores", value: summary?.unique_fornecedores, icon: "🏢" },
            { label: "Valor Médio Unit.", value: `R$ ${summary?.media_valor_unitario.toFixed(2)}`, icon: "🏷️" },
          ]}
        />
      </Card>

      {/* Fornecedores Chart */}
      <Card title="🏢 Distribuição por Fornecedor" description={`${fornecedores.length} fornecedores`}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fornecedores.slice(0, 10)} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="fornecedor" angle={-45} textAnchor="end" height={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total_valor" fill="#4f8ef7" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Categorias Pie */}
      <Card title="📂 Distribuição por Categoria">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categorias}
              dataKey="total_valor"
              nameKey="categoria"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ categoria, total_valor }) => `${categoria}: R$ ${(total_valor / 1000).toFixed(0)}K`}
            >
              {categorias.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* Materials Table */}
      <Card title="📋 Relação de Materiais" description={`${filteredMateriais.length} itens`}>
        <div style={{ marginBottom: "16px" }}>
          <select
            value={filterCategoria}
            onChange={e => setFilterCategoria(e.target.value)}
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
            {allCategorias.map(cat => (
              <option key={cat} value={cat}>
                {cat === "all" ? `Todas categorias (${materiais.length})` : cat}
              </option>
            ))}
          </select>
        </div>

        {filteredMateriais.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
            Nenhum material encontrado para a categoria selecionada
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(79, 142, 247, 0.05)", borderBottom: "2px solid #334155" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Material</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#94a3b8" }}>Quantidade</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#94a3b8" }}>Valor Unit.</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#94a3b8" }}>Total</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Fornecedor</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {filteredMateriais.slice(0, 50).map((mat, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #334155", backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(30, 41, 59, 0.3)" }}>
                    <td style={{ padding: "12px", color: "#cbd5e1" }}>{mat.material}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#4f8ef7", fontWeight: "600" }}>{mat.quantidade}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#34c97e" }}>R$ {mat.valor_unitario.toFixed(2)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#f5a623", fontWeight: "600" }}>R$ {mat.valor_total.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: "12px", color: "#cbd5e1" }}>{mat.fornecedor}</td>
                    <td style={{ padding: "12px", color: "#cbd5e1" }}>{mat.categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg) }
        }
      `}</style>
    </DashboardLayout>
  )
}
