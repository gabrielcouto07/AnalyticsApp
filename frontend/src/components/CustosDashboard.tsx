"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson } from "../api/analytics"

type TabId = "nfs" | "consolidado" | "orcado-realizado" | "resumo"
type GenericRow = Record<string, unknown>
type OrcadoRealizadoItem = {
  item: string
  descricao: string
  verba_total: number
  periodos: Array<{ periodo: number; desembolso: number }>
}

const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "nfs", label: "NFs" },
  { id: "consolidado", label: "Consolidado" },
  { id: "orcado-realizado", label: "Orcado x Realizado" },
  { id: "resumo", label: "Resumo" },
]

const NATUREZA_ORDER = [
  "Material / Servico",
  "Mao Obra Empr.",
  "Mao Obra Tempo.",
  "Staff",
  "Servicos s/ TxAdm",
]
const SITUACAO_OPTIONS = ["Todas", "A PAGAR", "PAGO", "VENCIDO"]

const PAGE_SIZE = 50

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
      <div style={filterSkeletonStyle} />
      <div style={panelSkeletonStyle} />
      <div style={panelSkeletonStyle} />
      <style>{skeletonStyle}</style>
    </div>
  )
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0
  const cleaned = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateValue(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function selectMultiValues(options: HTMLOptionsCollection) {
  return Array.from(options)
    .filter((option) => option.selected)
    .map((option) => option.value)
}

function resolveSituacaoLabel(rawSituacao: unknown, rawDate: unknown) {
  const situacao = normalizeText(rawSituacao)
  if (situacao.includes("pago")) return "PAGO"
  if (situacao.includes("venc")) return "VENCIDO"

  const dueDate = parseDateValue(rawDate)
  if (dueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    if (dueDate < today) return "VENCIDO"
  }

  return "A PAGAR"
}

function formatDate(value: unknown) {
  if (!value) return "-"
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString("pt-BR")
}

function findColumn(rows: GenericRow[], candidates: string[]) {
  const keys = Object.keys(rows[0] ?? {})
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate)
    const match = keys.find((key) => normalizeText(key) === normalizedCandidate)
    if (match) return match
  }
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate)
    const match = keys.find((key) => normalizeText(key).includes(normalizedCandidate))
    if (match) return match
  }
  return null
}

function getValue(row: GenericRow, column: string | null) {
  return column ? row[column] : undefined
}

function paginateRows<T>(rows: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return {
    page: safePage,
    totalPages,
    start,
    end: Math.min(start + PAGE_SIZE, rows.length),
    rows: rows.slice(start, start + PAGE_SIZE),
  }
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
      <span style={{ color: "#64748b", fontSize: 13 }}>
        Pagina {page} de {totalPages}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={pagerButtonStyle} onClick={() => onChange(Math.max(1, page - 1))}>
          Anterior
        </button>
        <button type="button" style={pagerButtonStyle} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          Proxima
        </button>
      </div>
    </div>
  )
}

function EmptyTabMessage({ message }: { message: string }) {
  return (
    <section style={panelStyle}>
      <div style={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>{message}</p>
      </div>
    </section>
  )
}

export const CustosDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("nfs")
  const [nfsRows, setNfsRows] = useState<GenericRow[]>([])
  const [consolidadoRows, setConsolidadoRows] = useState<GenericRow[]>([])
  const [orcadoRealizadoRows, setOrcadoRealizadoRows] = useState<OrcadoRealizadoItem[]>([])
  const [resumoRows, setResumoRows] = useState<GenericRow[]>([])
  const [selectedNaturezas, setSelectedNaturezas] = useState<string[]>([])
  const [selectedConsolidadoNaturezas, setSelectedConsolidadoNaturezas] = useState<string[]>([])
  const [selectedSituacao, setSelectedSituacao] = useState("Todas")
  const [consolidadoFornecedorSearch, setConsolidadoFornecedorSearch] = useState("")
  const [consolidadoDateFrom, setConsolidadoDateFrom] = useState("")
  const [consolidadoDateTo, setConsolidadoDateTo] = useState("")
  const [selectedItem, setSelectedItem] = useState("")
  const [nfsPage, setNfsPage] = useState(1)
  const [consolidadoPage, setConsolidadoPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<GenericRow[]>(`/api/custos/${sessionId}/nfs`),
      fetchApiJson<GenericRow[]>(`/api/custos/${sessionId}/consolidado`),
      fetchApiJson<OrcadoRealizadoItem[]>(`/api/custos/${sessionId}/orcado_realizado`),
      fetchApiJson<GenericRow[]>(`/api/custos/${sessionId}/resumo`),
    ])
      .then(([nextNfs, nextConsolidado, nextOrcadoRealizado, nextResumo]) => {
        if (!active) return
        setNfsRows(nextNfs)
        setConsolidadoRows(nextConsolidado)
        setOrcadoRealizadoRows(nextOrcadoRealizado)
        setResumoRows(nextResumo)
        setSelectedItem(nextOrcadoRealizado[0]?.item ?? "")
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar dados de custos.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const nfsColumns = useMemo(() => {
    return {
      consolidado: findColumn(nfsRows, ["NumConsolidado", "Nº CONSOLIDADO", "N CONSOLIDADO"]),
      fornecedor: findColumn(nfsRows, ["Fornecedor", "FORNECEDOR"]),
      nf: findColumn(nfsRows, ["NF"]),
      natureza: findColumn(nfsRows, ["Natureza", "NATUREZA"]),
      dataVencto: findColumn(nfsRows, ["DataVencto", "DATA VENCTO"]),
      valor: findColumn(nfsRows, ["Valor", "VALOR"]),
      situacao: findColumn(nfsRows, ["SituacaoPlanilha", "SITUACAO PLANILHA", "SITUACAO"]),
      saldo: findColumn(nfsRows, ["SaldoPlanilha", "SALDO PLANILHA"]),
    }
  }, [nfsRows])

  const consolidadoColumns = useMemo(() => {
    return {
      natureza: findColumn(consolidadoRows, ["Natureza", "NATUREZA"]),
      fornecedor: findColumn(consolidadoRows, ["Fornecedor", "FORNECEDOR"]),
      dataVencto: findColumn(consolidadoRows, ["DataVencto", "DATA VENCTO"]),
      valor: findColumn(consolidadoRows, ["Valor", "VALOR"]),
      apropriValor: findColumn(consolidadoRows, ["ApropriValor", "VALOR APROPRIADO"]),
    }
  }, [consolidadoRows])

  const resumoColumns = useMemo(() => {
    const keys = Object.keys(resumoRows[0] ?? {})
    const totalGeral =
      keys.find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("total") && normalized.includes("geral")
      }) ?? null
    const taxaAdm =
      keys.find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("taxa") && normalized.includes("adm")
      }) ?? null
    const materialServico =
      keys.find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("material") && normalized.includes("servico")
      }) ?? null
    const maoObraEmpreitada =
      keys.find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("mao obra") && normalized.includes("empreitada")
      }) ?? null
    const maoObraTempo =
      keys.find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("mao obra") && normalized.includes("tempo")
      }) ?? null
    return { totalGeral, taxaAdm, materialServico, maoObraEmpreitada, maoObraTempo, all: keys }
  }, [resumoRows])

  const filteredNfs = useMemo(() => {
    return nfsRows.filter((row) => {
      const natureza = String(getValue(row, nfsColumns.natureza) ?? "").trim()
      const matchesNatureza = selectedNaturezas.length === 0 || selectedNaturezas.includes(natureza)
      const situacaoLabel = resolveSituacaoLabel(
        getValue(row, nfsColumns.situacao),
        getValue(row, nfsColumns.dataVencto),
      )
      const matchesSituacao = selectedSituacao === "Todas" || situacaoLabel === selectedSituacao
      return matchesNatureza && matchesSituacao
    })
  }, [nfsColumns.dataVencto, nfsColumns.natureza, nfsColumns.situacao, nfsRows, selectedNaturezas, selectedSituacao])

  const filteredConsolidado = useMemo(() => {
    return consolidadoRows.filter((row) => {
      const natureza = String(getValue(row, consolidadoColumns.natureza) ?? "").trim()
      const fornecedor = String(getValue(row, consolidadoColumns.fornecedor) ?? "").trim()
      const dataVencto = parseDateValue(getValue(row, consolidadoColumns.dataVencto))
      const matchesNatureza =
        selectedConsolidadoNaturezas.length === 0 || selectedConsolidadoNaturezas.includes(natureza)
      const matchesFornecedor =
        !consolidadoFornecedorSearch ||
        normalizeText(fornecedor).includes(normalizeText(consolidadoFornecedorSearch))
      const matchesDateFrom = !consolidadoDateFrom || (dataVencto !== null && dataVencto >= new Date(`${consolidadoDateFrom}T00:00:00`))
      const matchesDateTo = !consolidadoDateTo || (dataVencto !== null && dataVencto <= new Date(`${consolidadoDateTo}T23:59:59`))
      return matchesNatureza && matchesFornecedor && matchesDateFrom && matchesDateTo
    })
  }, [
    consolidadoColumns.dataVencto,
    consolidadoColumns.fornecedor,
    consolidadoColumns.natureza,
    consolidadoDateFrom,
    consolidadoDateTo,
    consolidadoFornecedorSearch,
    consolidadoRows,
    selectedConsolidadoNaturezas,
  ])

  const naturezaOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        nfsRows
          .map((row) => String(getValue(row, nfsColumns.natureza) ?? "").trim())
          .filter(Boolean),
      ),
    )
    const prioritized = NATUREZA_ORDER.filter((option) =>
      values.some((value) => normalizeText(value) === normalizeText(option)),
    )
    const remaining = values.filter(
      (value) => !prioritized.some((option) => normalizeText(option) === normalizeText(value)),
    )
    return [...prioritized, ...remaining]
  }, [nfsColumns.natureza, nfsRows])

  const consolidadoNaturezaOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        consolidadoRows
          .map((row) => String(getValue(row, consolidadoColumns.natureza) ?? "").trim())
          .filter(Boolean),
      ),
    )
    const prioritized = NATUREZA_ORDER.filter((option) =>
      values.some((value) => normalizeText(value) === normalizeText(option)),
    )
    const remaining = values.filter(
      (value) => !prioritized.some((option) => normalizeText(option) === normalizeText(value)),
    )
    return [...prioritized, ...remaining]
  }, [consolidadoColumns.natureza, consolidadoRows])

  const nfsKpis = useMemo(() => {
    const totalValor = filteredNfs.reduce((sum, row) => sum + parseNumber(getValue(row, nfsColumns.valor)), 0)
    const valorEmAberto = filteredNfs.reduce((sum, row) => {
      const situacao = resolveSituacaoLabel(getValue(row, nfsColumns.situacao), getValue(row, nfsColumns.dataVencto))
      return situacao === "A PAGAR" || situacao === "VENCIDO"
        ? sum + parseNumber(getValue(row, nfsColumns.valor))
        : sum
    }, 0)
    const fornecedores = new Set(
      filteredNfs
        .map((row) => String(getValue(row, nfsColumns.fornecedor) ?? "").trim())
        .filter(Boolean),
    )
    return {
      totalNfs: filteredNfs.length,
      totalValor,
      valorEmAberto,
      fornecedores: fornecedores.size,
    }
  }, [filteredNfs, nfsColumns.dataVencto, nfsColumns.fornecedor, nfsColumns.situacao, nfsColumns.valor])

  const naturezaChart = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredNfs) {
      const natureza = String(getValue(row, nfsColumns.natureza) ?? "Sem natureza").trim() || "Sem natureza"
      grouped.set(natureza, (grouped.get(natureza) ?? 0) + parseNumber(getValue(row, nfsColumns.valor)))
    }
    return Array.from(grouped.entries())
      .map(([natureza, valor]) => ({ natureza, valor }))
      .sort((left, right) => right.valor - left.valor)
  }, [filteredNfs, nfsColumns.natureza, nfsColumns.valor])

  const consolidadoKpis = useMemo(() => {
    return {
      pagamentos: filteredConsolidado.length,
      valorTotal: filteredConsolidado.reduce(
        (sum, row) => sum + parseNumber(getValue(row, consolidadoColumns.valor)),
        0,
      ),
      valorApropriado: filteredConsolidado.reduce(
        (sum, row) => sum + parseNumber(getValue(row, consolidadoColumns.apropriValor)),
        0,
      ),
    }
  }, [consolidadoColumns.apropriValor, consolidadoColumns.valor, filteredConsolidado])

  const orcadoSummaryRows = useMemo(() => {
    return orcadoRealizadoRows.map((row) => {
      const realizado = row.periodos.reduce((sum, periodo) => sum + Number(periodo.desembolso || 0), 0)
      return {
        item: row.item,
        descricao: row.descricao,
        verbaTotal: row.verba_total,
        realizado,
        saldo: row.verba_total - realizado,
      }
    })
  }, [orcadoRealizadoRows])

  const selectedOrcadoItem = useMemo(() => {
    return orcadoRealizadoRows.find((row) => row.item === selectedItem) ?? orcadoRealizadoRows[0] ?? null
  }, [orcadoRealizadoRows, selectedItem])

  const orcadoChartRows = useMemo(() => {
    if (!selectedOrcadoItem) return []
    return selectedOrcadoItem.periodos
      .slice()
      .sort((left, right) => left.periodo - right.periodo)
      .map((periodo) => ({
        periodo: periodo.periodo,
        verba: selectedOrcadoItem.verba_total,
        desembolso: Number(periodo.desembolso || 0),
      }))
  }, [selectedOrcadoItem])

  const resumoKpis = useMemo(() => {
    return {
      totalGeral: resumoRows.reduce(
        (sum, row) => sum + parseNumber(getValue(row, resumoColumns.totalGeral)),
        0,
      ),
      totalMaterialServico: resumoRows.reduce(
        (sum, row) => sum + parseNumber(getValue(row, resumoColumns.materialServico)),
        0,
      ),
      totalMaoObra: resumoRows.reduce(
        (sum, row) =>
          sum +
          parseNumber(getValue(row, resumoColumns.maoObraEmpreitada)) +
          parseNumber(getValue(row, resumoColumns.maoObraTempo)),
        0,
      ),
      taxaAdministracao: resumoRows.reduce(
        (sum, row) => sum + parseNumber(getValue(row, resumoColumns.taxaAdm)),
        0,
      ),
    }
  }, [
    resumoColumns.maoObraEmpreitada,
    resumoColumns.maoObraTempo,
    resumoColumns.materialServico,
    resumoColumns.taxaAdm,
    resumoColumns.totalGeral,
    resumoRows,
  ])

  const pagedNfs = paginateRows(filteredNfs, nfsPage)
  const pagedConsolidado = paginateRows(filteredConsolidado, consolidadoPage)

  const handleResumoExport = () => {
    fetch(`/api/export/${sessionId}`)
      .then((response) => response.blob())
      .then((blob) => {
        const anchor = document.createElement("a")
        anchor.href = URL.createObjectURL(blob)
        anchor.download = "export.xlsx"
        anchor.click()
      })
  }

  if (loading) return <DashboardSkeleton />

  if (error) {
    return <EmptyTabMessage message={error} />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Controle de Custos</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          NFs, consolidado, orcado x realizado e resumo financeiro do arquivo enviado.
        </p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 8, gap: 16 }}>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === tab.id ? "2px solid #0b4f3a" : "2px solid transparent",
              color: activeTab === tab.id ? "#0b4f3a" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 600,
              padding: "0 2px 10px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "nfs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {[
              { label: "Total NFs", value: nfsKpis.totalNfs.toLocaleString("pt-BR") },
              { label: "Valor Total", value: formatCurrency(nfsKpis.totalValor) },
              { label: "Valor em Aberto", value: formatCurrency(nfsKpis.valorEmAberto) },
              { label: "Fornecedores", value: nfsKpis.fornecedores.toLocaleString("pt-BR") },
            ].map((card) => (
              <div key={card.label} style={metricCardStyle}>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                  {card.label}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0b4f3a" }}>{card.value}</p>
              </div>
            ))}
          </div>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Valor por Natureza</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={naturezaChart} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="natureza" width={180} tick={{ fill: "#0f172a", fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="valor" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <div style={filterPanelStyle}>
            <label style={filterLabelStyle}>
              Natureza
              <select
                multiple
                value={selectedNaturezas}
                onChange={(event) => {
                  setSelectedNaturezas(selectMultiValues(event.currentTarget.options))
                  setNfsPage(1)
                }}
                style={filterSelectStyle}
              >
                {naturezaOptions.map((natureza) => (
                  <option key={natureza} value={natureza}>
                    {natureza}
                  </option>
                ))}
              </select>
            </label>
            <label style={filterLabelStyle}>
              Situacao
              <select
                value={selectedSituacao}
                onChange={(event) => {
                  setSelectedSituacao(event.target.value)
                  setNfsPage(1)
                }}
                style={filterInputStyle}
              >
                {SITUACAO_OPTIONS.map((situacao) => (
                  <option key={situacao} value={situacao}>
                    {situacao}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedNaturezas([])
                setSelectedSituacao("Todas")
                setNfsPage(1)
              }}
              style={resetButtonStyle}
            >
              Limpar Filtros
            </button>
          </div>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Tabela de NFs</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      ["NumConsolidado", nfsColumns.consolidado],
                      ["Fornecedor", nfsColumns.fornecedor],
                      ["NF", nfsColumns.nf],
                      ["Natureza", nfsColumns.natureza],
                      ["DataVencto", nfsColumns.dataVencto],
                      ["Valor", nfsColumns.valor],
                      ["SituacaoPlanilha", nfsColumns.situacao],
                      ["SaldoPlanilha", nfsColumns.saldo],
                    ].map(([label, column]) => (
                      <th key={label} style={thStyle}>
                        {column ?? label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedNfs.rows.map((row, index) => (
                    <tr key={`${getValue(row, nfsColumns.nf)}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}>
                      <td style={tdStyle}>{String(getValue(row, nfsColumns.consolidado) ?? "-")}</td>
                      <td style={tdStyle}>{String(getValue(row, nfsColumns.fornecedor) ?? "-")}</td>
                      <td style={tdStyle}>{String(getValue(row, nfsColumns.nf) ?? "-")}</td>
                      <td style={tdStyle}>{String(getValue(row, nfsColumns.natureza) ?? "-")}</td>
                      <td style={tdStyle}>{formatDate(getValue(row, nfsColumns.dataVencto))}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                        {formatCurrency(parseNumber(getValue(row, nfsColumns.valor)))}
                      </td>
                      <td style={tdStyle}>{String(getValue(row, nfsColumns.situacao) ?? "-")}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {formatCurrency(parseNumber(getValue(row, nfsColumns.saldo)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedNfs.page} totalPages={pagedNfs.totalPages} onChange={setNfsPage} />
          </section>
        </div>
      )}

      {activeTab === "consolidado" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {[
              { label: "Pagamentos", value: consolidadoKpis.pagamentos.toLocaleString("pt-BR") },
              { label: "Valor Total", value: formatCurrency(consolidadoKpis.valorTotal) },
              { label: "Valor Apropriado", value: formatCurrency(consolidadoKpis.valorApropriado) },
            ].map((card) => (
              <div key={card.label} style={metricCardStyle}>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                  {card.label}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0b4f3a" }}>{card.value}</p>
              </div>
            ))}
          </div>

          <div style={filterPanelStyle}>
            <label style={filterLabelStyle}>
              Natureza
              <select
                multiple
                value={selectedConsolidadoNaturezas}
                onChange={(event) => {
                  setSelectedConsolidadoNaturezas(selectMultiValues(event.currentTarget.options))
                  setConsolidadoPage(1)
                }}
                style={filterSelectStyle}
              >
                {consolidadoNaturezaOptions.map((natureza) => (
                  <option key={natureza} value={natureza}>
                    {natureza}
                  </option>
                ))}
              </select>
            </label>
            <label style={filterLabelStyle}>
              Fornecedor
              <input
                type="text"
                value={consolidadoFornecedorSearch}
                onChange={(event) => {
                  setConsolidadoFornecedorSearch(event.target.value)
                  setConsolidadoPage(1)
                }}
                placeholder="Buscar fornecedor"
                style={filterInputStyle}
              />
            </label>
            <label style={filterLabelStyle}>
              Data Vencto de
              <input
                type="date"
                value={consolidadoDateFrom}
                onChange={(event) => {
                  setConsolidadoDateFrom(event.target.value)
                  setConsolidadoPage(1)
                }}
                style={dateInputStyle}
              />
            </label>
            <label style={filterLabelStyle}>
              ate
              <input
                type="date"
                value={consolidadoDateTo}
                onChange={(event) => {
                  setConsolidadoDateTo(event.target.value)
                  setConsolidadoPage(1)
                }}
                style={dateInputStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedConsolidadoNaturezas([])
                setConsolidadoFornecedorSearch("")
                setConsolidadoDateFrom("")
                setConsolidadoDateTo("")
                setConsolidadoPage(1)
              }}
              style={resetButtonStyle}
            >
              Limpar Filtros
            </button>
          </div>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Tabela Consolidada</h3>
            <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
              Exibindo {filteredConsolidado.length.toLocaleString("pt-BR")} de {consolidadoRows.length.toLocaleString("pt-BR")} registros - Total: {formatCurrency(consolidadoKpis.valorTotal)}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {Object.keys(consolidadoRows[0] ?? {}).map((column) => (
                      <th key={column} style={thStyle}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedConsolidado.rows.map((row, index) => (
                    <tr key={`${index}-${String(getValue(row, consolidadoColumns.fornecedor) ?? "")}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}>
                      {Object.keys(consolidadoRows[0] ?? {}).map((column) => {
                        const normalized = normalizeText(column)
                        const cell = row[column]
                        const isDate = normalized.includes("data")
                        const isCurrency = normalized.includes("valor")
                        return (
                          <td key={column} style={{ ...tdStyle, textAlign: isCurrency ? "right" : "left" }}>
                            {isDate
                              ? formatDate(cell)
                              : isCurrency
                                ? formatCurrency(parseNumber(cell))
                                : String(cell ?? "-")}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedConsolidado.page} totalPages={pagedConsolidado.totalPages} onChange={setConsolidadoPage} />
          </section>
        </div>
      )}

      {activeTab === "orcado-realizado" && (
        orcadoRealizadoRows.length === 0 ? (
          <EmptyTabMessage message="Dados de Orcado x Realizado nao disponiveis neste arquivo." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={filterPanelStyle}>
              <label style={filterLabelStyle}>
                ITEM
                <select
                  value={selectedOrcadoItem?.item ?? ""}
                  onChange={(event) => setSelectedItem(event.target.value)}
                  style={filterInputStyle}
                >
                  {orcadoRealizadoRows.map((row) => (
                    <option key={row.item} value={row.item}>
                      {row.item} - {row.descricao}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section style={panelStyle}>
              <h3 style={panelTitleStyle}>Verba x Desembolso</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={orcadoChartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Line type="monotone" dataKey="verba" stroke="#0b4f3a" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="desembolso" stroke="#4f8ef7" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section style={panelStyle}>
              <h3 style={panelTitleStyle}>Resumo</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["ITEM", "DESCRICAO", "VERBA TOTAL", "REALIZADO", "SALDO"].map((column) => (
                        <th key={column} style={thStyle}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orcadoSummaryRows.map((row) => (
                      <tr key={row.item}>
                        <td style={tdStyle}>{row.item}</td>
                        <td style={tdStyle}>{row.descricao}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(row.verbaTotal)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(row.realizado)}</td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: 800,
                            background: row.saldo < 0 ? "rgba(248,113,113,0.18)" : "rgba(34,197,94,0.18)",
                            color: row.saldo < 0 ? "#991b1b" : "#166534",
                          }}
                        >
                          {formatCurrency(row.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )
      )}

      {activeTab === "resumo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {[
              { label: "Total Geral", value: formatCurrency(resumoKpis.totalGeral) },
              { label: "Total Material / Servico", value: formatCurrency(resumoKpis.totalMaterialServico) },
              { label: "Total Mao Obra", value: formatCurrency(resumoKpis.totalMaoObra) },
              { label: "Taxa Adm Total", value: formatCurrency(resumoKpis.taxaAdministracao) },
            ].map((card) => (
              <div key={card.label} style={metricCardStyle}>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                  {card.label}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0b4f3a" }}>{card.value}</p>
              </div>
            ))}
          </div>

          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h3 style={{ ...panelTitleStyle, margin: 0 }}>Resumo Consolidado</h3>
              <button type="button" onClick={handleResumoExport} style={resetButtonStyle}>
                Exportar
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {resumoColumns.all.map((column) => (
                      <th key={column} style={thStyle}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumoRows.map((row, index) => (
                    <tr key={`${index}-${String(row[resumoColumns.all[0] ?? ""] ?? "")}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}>
                      {resumoColumns.all.map((column) => {
                        const normalized = normalizeText(column)
                        const cell = row[column]
                        const isDate = normalized.includes("data")
                        const isCurrency =
                          !normalized.includes("%") &&
                          (normalized.includes("total") ||
                            normalized.includes("taxa") ||
                            normalized.includes("material") ||
                            normalized.includes("obra") ||
                            normalized.includes("staff") ||
                            normalized.includes("servico"))
                        return (
                          <td key={column} style={{ ...tdStyle, textAlign: isCurrency ? "right" : "left" }}>
                            {isDate
                              ? formatDate(cell)
                              : isCurrency
                                ? formatCurrency(parseNumber(cell))
                                : String(cell ?? "-")}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

const skeletonStyle = `
  @keyframes custos-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const cardSkeletonStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "custos-wave 1.4s ease infinite",
}

const panelSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 280,
}

const filterSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 88,
}

const filterPanelStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 16,
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 220,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
}

const filterInputStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 10px",
  fontSize: 13,
  height: 38,
}

const filterSelectStyle: React.CSSProperties = {
  width: 220,
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 10px",
  fontSize: 13,
  minHeight: 90,
}

const dateInputStyle: React.CSSProperties = {
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  height: 38,
}

const resetButtonStyle: React.CSSProperties = {
  background: "#0b4f3a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 800,
  cursor: "pointer",
}

const metricCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: "16px 20px",
}

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  whiteSpace: "nowrap",
}

const pagerButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(11,79,58,0.18)",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
}
