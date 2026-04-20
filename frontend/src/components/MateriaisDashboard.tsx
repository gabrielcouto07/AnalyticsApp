import React, { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend, Area, AreaChart
} from "recharts"
import { ExplainerModal, useExplainerModal, type ExplainerContent } from "./ExplainerModal"

import { api } from "../api/client"

const API = api.defaults.baseURL

const COLORS = [
  "#34c97e", "#4f8ef7", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]
const WINNER_COLOR = "#34c97e"
const LOSER_COLOR = "#475569"

interface MateriaisDashboardProps {
  sessionId: string
}

interface KPIData {
  items: number
  suppliers: number
  minPrice: number
  supplier: string
  totalValue: number
  services: number
  inputs: number
}

interface ChartData {
  name: string
  value: number
  formatted: string
}

interface PriceComparison {
  item: string
  quantity: number
  type: string
  prices: Record<string, number>
}

export function MateriaisDashboard({ sessionId }: MateriaisDashboardProps) {
  const [kpi, setKpi] = useState<KPIData | null>(null)
  const [supplierChart, setSupplierChart] = useState<ChartData[]>([])
  const [typeChart, setTypeChart] = useState<ChartData[]>([])
  const [comparison, setComparison] = useState<PriceComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"summary" | "comparison" | "analysis">("summary")
  const modal = useExplainerModal()

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${API}/materiais/analysis/${sessionId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        setKpi(data.kpi)
        setSupplierChart(data.supplierChart || [])
        setTypeChart(data.typeChart || [])
        setComparison(data.comparison || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        console.error("Materiais dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ color: "#94a3b8", fontSize: "14px" }}>⏳ Carregando análise de Materiais...</p>
      </div>
    )
  }

  if (error || !kpi) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontSize: "14px" }}>❌ Erro ao carregar dashboard: {error}</p>
      </div>
    )
  }

  return (
    <div style={{
      padding: "24px",
      backgroundColor: "#0f172a",
      borderRadius: "16px",
      color: "#f1f5f9",
      minHeight: "calc(100vh - 120px)",
      animation: "fadeIn 0.6s ease-in"
    }}>
      {/* Header */}
      <div style={{
        marginBottom: "32px",
        paddingBottom: "24px",
        borderBottom: "2px solid #1e293b"
      }}>
        <h2 style={{
          margin: "0 0 8px 0",
          fontSize: "28px",
          fontWeight: "700",
          color: "#f1f5f9",
          background: "linear-gradient(135deg, #34c97e 0%, #06b6d4 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          💰 Mapa de Concorrência
        </h2>
        <p style={{ margin: "0", fontSize: "13px", color: "#94a3b8" }}>
          Análise Completa de Materiais e Fornecedores
        </p>
      </div>

      {/* KPI Cards - Enhanced */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "16px",
        marginBottom: "32px"
      }}>
        {[
          {
            icon: "📦",
            label: "Total Itens",
            value: kpi.items,
            color: "#4f8ef7",
            gradient: "linear-gradient(135deg, #4f8ef7 0%, #3b82f6 100%)",
            onClickExplainer: () => modal.open({
              title: "Total Itens",
              definition: "Quantidade total de materiais únicos cadastrados na análise.",
              calculation: "COUNT(DISTINCT item_id)",
              value: kpi.items,
              source: "Dados de Materiais",
              details: { "Itens cadastrados": kpi.items }
            })
          },
          {
            icon: "🏢",
            label: "Fornecedores",
            value: kpi.suppliers,
            color: "#f5a623",
            gradient: "linear-gradient(135deg, #f5a623 0%, #f97316 100%)",
            onClickExplainer: () => modal.open({
              title: "Total Fornecedores",
              definition: "Número de fornecedores distintos que oferecem esses materiais.",
              calculation: "COUNT(DISTINCT supplier_id)",
              value: kpi.suppliers,
              source: "Dados de Fornecedores",
              details: { "Fornecedores ativos": kpi.suppliers }
            })
          },
          {
            icon: "🏆",
            label: "Menor Preço",
            value: `R$ ${kpi.minPrice.toLocaleString("pt-BR")}`,
            supplier: kpi.supplier,
            color: "#34c97e",
            gradient: "linear-gradient(135deg, #34c97e 0%, #10b981 100%)",
            onClickExplainer: () => modal.open({
              title: "Menor Preço por Item",
              definition: "Valor mínimo encontrado entre todos os itens e fornecedores.",
              calculation: "MIN(price) per item",
              value: `R$ ${kpi.minPrice.toLocaleString("pt-BR")}`,
              source: "Comparação de Preços",
              details: {
                "Menor preço": `R$ ${kpi.minPrice.toLocaleString("pt-BR")}`,
                "Fornecedor": kpi.supplier
              }
            })
          },
          {
            icon: "💵",
            label: "Valor Total",
            value: `R$ ${kpi.totalValue.toLocaleString("pt-BR")}`,
            color: "#a78bfa",
            gradient: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
            onClickExplainer: () => modal.open({
              title: "Valor Total",
              definition: "Soma de todos os valores de materiais (quantidade × preço unitário).",
              calculation: "SUM(quantity × unit_price)",
              value: `R$ ${kpi.totalValue.toLocaleString("pt-BR")}`,
              source: "Consolidação de Materiais",
              details: { "Valor consolidado": `R$ ${kpi.totalValue.toLocaleString("pt-BR")}` }
            })
          },
          {
            icon: "🔧",
            label: "Serviços",
            value: kpi.services,
            color: "#06b6d4",
            gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
            onClickExplainer: () => modal.open({
              title: "Itens de Serviço",
              definition: "Quantidade de itens classificados como serviços (não-produtos).",
              calculation: "COUNT(*) WHERE type = 'Serviço'",
              value: kpi.services,
              source: "Classificação de Materiais",
              details: { "Serviços": kpi.services, "Percentual": `${((kpi.services / kpi.items) * 100).toFixed(1)}%` }
            })
          },
          {
            icon: "📋",
            label: "Insumos",
            value: kpi.inputs,
            color: "#ec4899",
            gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            onClickExplainer: () => modal.open({
              title: "Itens de Insumo",
              definition: "Quantidade de itens classificados como insumos/produtos.",
              calculation: "COUNT(*) WHERE type = 'Insumo'",
              value: kpi.inputs,
              source: "Classificação de Materiais",
              details: { "Insumos": kpi.inputs, "Percentual": `${((kpi.inputs / kpi.items) * 100).toFixed(1)}%` }
            })
          },
        ].map((card, idx) => (
          <div key={idx} 
            onClick={card.onClickExplainer}
            style={{
              background: card.gradient,
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)"
              e.currentTarget.style.boxShadow = "0 15px 40px rgba(0,0,0,0.3)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)"
            }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>{card.icon}</div>
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: "600" }}>
              {card.label}
            </p>
            <p style={{ margin: "0", fontSize: "20px", fontWeight: "700", color: "#fff" }}>
              {card.value}
            </p>
            {card.supplier && (
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                {card.supplier}
              </p>
            )}
            <p style={{ margin: "8px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
              Clique para detalhes ➜
            </p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.content && (
        <ExplainerModal
          isOpen={modal.isOpen}
          onClose={modal.close}
          content={modal.content}
        />
      )}

      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        gap: "0",
        marginBottom: "24px",
        borderBottom: "1px solid #334155",
        borderRadius: "8px 8px 0 0",
        backgroundColor: "#1e293b"
      }}>
        {["summary", "comparison", "analysis"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: activeTab === tab ? "linear-gradient(135deg, #34c97e 0%, #10b981 100%)" : "transparent",
              color: activeTab === tab ? "#fff" : "#94a3b8",
              border: "none",
              borderBottom: activeTab === tab ? "3px solid #34c97e" : "1px solid transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab ? "700" : "600",
              fontSize: "14px",
              transition: "all 0.3s ease",
              textTransform: "capitalize"
            }}
          >
            {tab === "summary" && "📊 Resumo"}
            {tab === "comparison" && "🔄 Comparativo"}
            {tab === "analysis" && "📈 Análise"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "24px"
        }}>
          {/* Supplier Price Chart */}
          <div style={{
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #334155",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "700",
              color: "#f1f5f9"
            }}>
              📊 Preço Total por Fornecedor
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={supplierChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f1f5f9"
                  }}
                  formatter={(value) => `R$ ${value.toLocaleString("pt-BR")}`}
                />
                <Bar dataKey="value" fill={WINNER_COLOR} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Type Distribution Chart */}
          <div style={{
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #334155",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "700",
              color: "#f1f5f9"
            }}>
              🔧 Distribuição por Tipo
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={typeChart}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "comparison" && (
        <div style={{
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #334155",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
          overflowX: "auto"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#f1f5f9" }}>
            🔄 Comparativo de Preços — Item × Fornecedor
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#94a3b8" }}>
            Células verdes = menor preço para o item
          </p>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px"
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155" }}>
                <th style={{ textAlign: "left", padding: "12px", color: "#f1f5f9", fontWeight: "700" }}>#</th>
                <th style={{ textAlign: "left", padding: "12px", color: "#f1f5f9", fontWeight: "700" }}>Descrição</th>
                <th style={{ textAlign: "center", padding: "12px", color: "#f1f5f9", fontWeight: "700" }}>Qtd</th>
                <th style={{ textAlign: "center", padding: "12px", color: "#f1f5f9", fontWeight: "700" }}>Tipo</th>
                {Object.keys(comparison[0]?.prices || {}).map((supplier) => (
                  <th key={supplier} style={{ textAlign: "right", padding: "12px", color: "#f1f5f9", fontWeight: "700" }}>
                    {supplier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((item, idx) => {
                const minPrice = Math.min(...Object.values(item.prices))
                return (
                  <tr key={idx} style={{
                    borderBottom: "1px solid #334155",
                    backgroundColor: idx % 2 === 0 ? "#0f172a" : "transparent"
                  }}>
                    <td style={{ padding: "12px", color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ padding: "12px", color: "#f1f5f9" }}>
                      <span title={item.item}>{item.item.substring(0, 40)}...</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "12px", color: "#f1f5f9" }}>{item.quantity}</td>
                    <td style={{ textAlign: "center", padding: "12px", color: "#f1f5f9" }}>{item.type}</td>
                    {Object.entries(item.prices).map(([supplier, price]) => (
                      <td
                        key={`${idx}-${supplier}`}
                        style={{
                          textAlign: "right",
                          padding: "12px",
                          backgroundColor: price === minPrice ? "rgba(52, 201, 126, 0.1)" : "transparent",
                          color: price === minPrice ? "#34c97e" : "#f1f5f9",
                          fontWeight: price === minPrice ? "700" : "400"
                        }}
                      >
                        R$ {price.toLocaleString("pt-BR")}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "analysis" && (
        <div style={{
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #334155",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#f1f5f9" }}>
            📈 Análise Detalhada
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px"
          }}>
            <div style={{ padding: "12px", backgroundColor: "rgba(52, 201, 126, 0.1)", borderRadius: "8px", border: "1px solid rgba(52, 201, 126, 0.3)" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#94a3b8" }}>Maior Fornecedor</p>
              <p style={{ margin: "0", fontSize: "16px", fontWeight: "700", color: "#34c97e" }}>{kpi.supplier}</p>
            </div>
            <div style={{ padding: "12px", backgroundColor: "rgba(79, 142, 247, 0.1)", borderRadius: "8px", border: "1px solid rgba(79, 142, 247, 0.3)" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#94a3b8" }}>Razão Serviços/Insumos</p>
              <p style={{ margin: "0", fontSize: "16px", fontWeight: "700", color: "#4f8ef7" }}>
                {kpi.inputs > 0 ? (kpi.services / kpi.inputs).toFixed(2) : "∞"} : 1
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
