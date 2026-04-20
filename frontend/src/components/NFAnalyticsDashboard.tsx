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
  total_nfs: number
  total_value: number
  unique_suppliers: number
  average_invoice_value: number
}

interface Supplier {
  supplier: string
  total_value: number
  invoice_count: number
  avg_invoice_value: number
}

interface Nature {
  nature: string
  total_value: number
  invoice_count: number
}

interface Timeline {
  period: string
  total_value: number
  invoice_count: number
}

interface TopInvoice {
  nf: string
  supplier: string
  total_value: number
  date: string
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

export const NFAnalyticsDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [natures, setNatures] = useState<Nature[]>([])
  const [timeline, setTimeline] = useState<Timeline[]>([])
  const [topInvoices, setTopInvoices] = useState<TopInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const analysisRes = await fetch(`${API}/api/templates/nf/analysis/${sessionId}`).then(r => r.json())
        setSummary(analysisRes.summary)
        setSuppliers(analysisRes.suppliers || [])
        setNatures(analysisRes.natures || [])
        setTimeline(analysisRes.timeline || [])
        setTopInvoices(analysisRes.top_invoices || [])
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
            <p style={{ color: "#94a3b8" }}>Carregando dados de Notas Fiscais...</p>
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

  if (!summary || suppliers.length === 0) {
    return (
      <DashboardLayout title="Nenhum dado de NF" description="Estrutura não detectada">
        <Card>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📄</div>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#f1f5f9", marginBottom: "12px" }}>
              Nenhum dado de Nota Fiscal disponível
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
              O arquivo carregado não possui a estrutura esperada de "Análise de Notas Fiscais".
            </p>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="📄 Análise de Notas Fiscais"
      description={`${summary?.total_nfs} NFs • ${summary?.unique_suppliers} fornecedores`}
    >
      {/* KPIs */}
      <Card>
        <KPIGrid
          items={[
            { label: "Total NFs", value: summary?.total_nfs, icon: "📋" },
            { label: "Valor Total", value: `R$ ${(summary.total_value / 1000000).toFixed(1)}M`, icon: "💰" },
            { label: "Fornecedores", value: summary?.unique_suppliers, icon: "🏢" },
            { label: "Valor Médio", value: `R$ ${(summary.average_invoice_value / 1000).toFixed(0)}K`, icon: "📊" },
          ]}
        />
      </Card>

      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <Card title="📈 Evolução de NFs ao Longo do Tempo" description="Quantidade e valor acumulado">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="invoice_count" stroke="#4f8ef7" strokeWidth={2.5} dot={{ r: 3 }} name="Quantidade" />
              <Line yAxisId="right" type="monotone" dataKey="total_value" stroke="#34c97e" strokeWidth={2.5} dot={{ r: 3 }} name="Valor" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Suppliers Chart */}
      <Card title="🏢 Top Fornecedores" description={`${suppliers.length} fornecedores`}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={suppliers.slice(0, 10)} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="supplier" angle={-45} textAnchor="end" height={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total_value" fill="#4f8ef7" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Nature Pie */}
      {natures.length > 0 && (
        <Card title="📂 Distribuição por Natureza">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={natures}
                dataKey="total_value"
                nameKey="nature"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ nature, total_value }) => `${nature}: R$ ${(total_value / 1000000).toFixed(1)}M`}
              >
                {natures.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top Invoices Table */}
      {topInvoices.length > 0 && (
        <Card title="🔝 Maiores Notas Fiscais" description={`Top ${Math.min(20, topInvoices.length)}`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(79, 142, 247, 0.05)", borderBottom: "2px solid #334155" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>NF</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Fornecedor</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#94a3b8" }}>Valor</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#94a3b8" }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {topInvoices.slice(0, 20).map((inv, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #334155", backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(30, 41, 59, 0.3)" }}>
                    <td style={{ padding: "12px", color: "#4f8ef7", fontWeight: "600" }}>{inv.nf}</td>
                    <td style={{ padding: "12px", color: "#cbd5e1" }}>{inv.supplier}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#34c97e", fontWeight: "600" }}>R$ {inv.total_value.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: "12px", color: "#cbd5e1" }}>{inv.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg) }
        }
      `}</style>
    </DashboardLayout>
  )
}
