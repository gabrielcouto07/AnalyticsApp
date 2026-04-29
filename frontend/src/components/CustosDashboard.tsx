"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson, type CustosConsolidadoResponse, type CustosNfsResponse, type CustosOrcadoRealizadoResponse, type CustosResumoResponse } from "../api/analytics"
import { API_BASE_URL } from "../api/client"
import { EmptyState } from "./layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "./layout/schemaRequirements"
import { useSessionStore } from "../store/session"

type TabId = "nfs" | "consolidado" | "orcado-realizado" | "resumo"
type SortDirection = "asc" | "desc"
type SortState = { key: string; direction: SortDirection }
type TableRow = Record<string, string | number | null | undefined>

const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "nfs", label: "NFs" },
  { id: "consolidado", label: "Consolidado" },
  { id: "orcado-realizado", label: "Orçado × Realizado" },
  { id: "resumo", label: "Resumo" },
]

const NATUREZA_OPTIONS = [
  "Material / Serviço",
  "Mão Obra Empr.",
  "Mão Obra Tempo.",
  "Staff",
  "Serviços s/ TxAdm",
]

const NATUREZA_COLORS: Record<string, string> = {
  "Material / Serviço": "#60a5fa",
  "Mão Obra Empr.": "#fb923c",
  "Mão Obra Tempo.": "#facc15",
  Staff: "#c084fc",
  "Serviços s/ TxAdm": "#4ade80",
}

const PAGE_SIZE = 50

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0
  const cleaned = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateValue(value: unknown) {
  if (!value) return Number.NaN
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? Number.NaN : parsed.getTime()
}

function compareValues(left: unknown, right: unknown) {
  const leftDate = parseDateValue(left)
  const rightDate = parseDateValue(right)
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate

  const leftNumber = parseNumber(left)
  const rightNumber = parseNumber(right)
  const leftLooksNumeric = typeof left === "number" || /\d/.test(String(left ?? ""))
  const rightLooksNumeric = typeof right === "number" || /\d/.test(String(right ?? ""))
  if (leftLooksNumeric && rightLooksNumeric) return leftNumber - rightNumber

  return String(left ?? "").localeCompare(String(right ?? ""), "pt-BR", { numeric: true, sensitivity: "base" })
}

function sortRows<T extends TableRow>(rows: T[], sortState: SortState) {
  return [...rows].sort((left, right) => {
    const result = compareValues(left[sortState.key], right[sortState.key])
    return sortState.direction === "asc" ? result : -result
  })
}

function paginateRows<T>(rows: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  return {
    page: safePage,
    totalPages,
    rows: rows.slice(start, start + PAGE_SIZE),
  }
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>{value}</div>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
      <span style={{ color: "#94a3b8", fontSize: 13 }}>
        Página {page} de {totalPages}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.max(1, page - 1))}>
          Anterior
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          Próxima
        </button>
      </div>
    </div>
  )
}

export const CustosDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("nfs")
  const [nfsRows, setNfsRows] = useState<CustosNfsResponse>([])
  const [consolidadoRows, setConsolidadoRows] = useState<CustosConsolidadoResponse>([])
  const [orcadoRealizadoRows, setOrcadoRealizadoRows] = useState<CustosOrcadoRealizadoResponse>([])
  const [resumoRows, setResumoRows] = useState<CustosResumoResponse>([])
  const [selectedNaturezas, setSelectedNaturezas] = useState<string[]>([])
  const [selectedConsolidadoNaturezas, setSelectedConsolidadoNaturezas] = useState<string[]>([])
  const [fornecedorSearch, setFornecedorSearch] = useState("")
  const [consolidadoFornecedorSearch, setConsolidadoFornecedorSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedItem, setSelectedItem] = useState("")
  const [nfsSort, setNfsSort] = useState<SortState>({ key: "DATA VENCTO", direction: "desc" })
  const [consolidadoSort, setConsolidadoSort] = useState<SortState>({ key: "DATA VENCTO", direction: "desc" })
  const [resumoSort, setResumoSort] = useState<SortState>({ key: "Nº CONSOLIDADO", direction: "asc" })
  const [orcadoSort, setOrcadoSort] = useState<SortState>({ key: "item", direction: "asc" })
  const [nfsPage, setNfsPage] = useState(1)
  const [consolidadoPage, setConsolidadoPage] = useState(1)
  const [resumoPage, setResumoPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<CustosNfsResponse>(`/api/custos/${sessionId}/nfs`),
      fetchApiJson<CustosConsolidadoResponse>(`/api/custos/${sessionId}/consolidado`),
      fetchApiJson<CustosOrcadoRealizadoResponse>(`/api/custos/${sessionId}/orcado_realizado`),
      fetchApiJson<CustosResumoResponse>(`/api/custos/${sessionId}/resumo`),
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

  const filteredNfs = useMemo(() => {
    return nfsRows.filter((row) => {
      const natureza = String(row["NATUREZA"] ?? "")
      const fornecedor = String(row["FORNECEDOR"] ?? "")
      const vencto = parseDateValue(row["DATA VENCTO"])
      const matchesNatureza = selectedNaturezas.length === 0 || selectedNaturezas.includes(natureza)
      const matchesFornecedor = !fornecedorSearch || normalizeText(fornecedor).includes(normalizeText(fornecedorSearch))
      const matchesFrom = !dateFrom || Number.isNaN(vencto) || vencto >= new Date(dateFrom).getTime()
      const matchesTo = !dateTo || Number.isNaN(vencto) || vencto <= new Date(dateTo).getTime()
      return matchesNatureza && matchesFornecedor && matchesFrom && matchesTo
    })
  }, [dateFrom, dateTo, fornecedorSearch, nfsRows, selectedNaturezas])

  const filteredConsolidado = useMemo(() => {
    return consolidadoRows.filter((row) => {
      const natureza = String(row["NATUREZA"] ?? "")
      const fornecedor = String(row["FORNECEDOR"] ?? "")
      const matchesNatureza = selectedConsolidadoNaturezas.length === 0 || selectedConsolidadoNaturezas.includes(natureza)
      const matchesFornecedor =
        !consolidadoFornecedorSearch || normalizeText(fornecedor).includes(normalizeText(consolidadoFornecedorSearch))
      return matchesNatureza && matchesFornecedor
    })
  }, [consolidadoFornecedorSearch, consolidadoRows, selectedConsolidadoNaturezas])

  const naturezaChart = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredNfs) {
      const natureza = String(row["NATUREZA"] ?? "Sem natureza")
      grouped.set(natureza, (grouped.get(natureza) ?? 0) + parseNumber(row["VALOR"]))
    }
    return Array.from(grouped.entries()).map(([natureza, valor]) => ({ natureza, valor }))
  }, [filteredNfs])

  const nfsKpis = useMemo(() => {
    const totalValor = filteredNfs.reduce((sum, row) => sum + parseNumber(row["VALOR"]), 0)
    const valorEmAberto = filteredNfs.reduce((sum, row) => {
      return normalizeText(row["SITUAÇÃO PLANILHA"]).includes("aberto") ? sum + parseNumber(row["VALOR"]) : sum
    }, 0)
    const fornecedores = new Set(filteredNfs.map((row) => String(row["FORNECEDOR"] ?? "").trim()).filter(Boolean))
    return {
      totalNfs: filteredNfs.length,
      totalValor,
      valorEmAberto,
      fornecedores: fornecedores.size,
    }
  }, [filteredNfs])

  const consolidadoKpis = useMemo(() => {
    return {
      totalPagamentos: filteredConsolidado.length,
      totalValor: filteredConsolidado.reduce((sum, row) => sum + parseNumber(row["VALOR"]), 0),
      valorApropriado: filteredConsolidado.reduce((sum, row) => sum + parseNumber(row["VALOR APROPRIADO"]), 0),
    }
  }, [filteredConsolidado])

  const orcadoSummaryRows = useMemo(() => {
    return orcadoRealizadoRows.map((row) => {
      const desembolsoTotal = row.periodos.reduce((sum, periodo) => sum + periodo.desembolso, 0)
      return {
        item: row.item,
        descricao: row.descricao,
        verba_total: row.verba_total,
        desembolso_total: desembolsoTotal,
        saldo: row.verba_total - desembolsoTotal,
      }
    })
  }, [orcadoRealizadoRows])

  const selectedOrcadoItem = useMemo(
    () => orcadoRealizadoRows.find((row) => row.item === selectedItem) ?? orcadoRealizadoRows[0] ?? null,
    [orcadoRealizadoRows, selectedItem],
  )

  const orcadoChartData = useMemo(() => {
    if (!selectedOrcadoItem) return []
    return selectedOrcadoItem.periodos
      .slice()
      .sort((left, right) => left.periodo - right.periodo)
      .map((periodo) => ({
        periodo: String(periodo.periodo),
        verba: selectedOrcadoItem.verba_total,
        desembolso: periodo.desembolso,
      }))
  }, [selectedOrcadoItem])

  const resumoKpis = useMemo(() => {
    return {
      totalGeral: resumoRows.reduce((sum, row) => sum + parseNumber(row["TOTAL GERAL"]), 0),
      taxaAdministracao: resumoRows.reduce((sum, row) => sum + parseNumber(row["TAXA ADMINISTRAÇÃO"]), 0),
    }
  }, [resumoRows])

  const sortedNfs = useMemo(() => sortRows(filteredNfs as TableRow[], nfsSort), [filteredNfs, nfsSort])
  const sortedConsolidado = useMemo(
    () => sortRows(filteredConsolidado as TableRow[], consolidadoSort),
    [consolidadoSort, filteredConsolidado],
  )
  const sortedResumo = useMemo(() => sortRows(resumoRows as TableRow[], resumoSort), [resumoRows, resumoSort])
  const sortedOrcadoSummary = useMemo(
    () => sortRows(orcadoSummaryRows as TableRow[], orcadoSort),
    [orcadoSort, orcadoSummaryRows],
  )

  const pagedNfs = paginateRows(sortedNfs, nfsPage)
  const pagedConsolidado = paginateRows(sortedConsolidado, consolidadoPage)
  const pagedResumo = paginateRows(sortedResumo, resumoPage)

  const availableNaturezas = useMemo(() => {
    const values = new Set<string>()
    for (const row of nfsRows) {
      const natureza = String(row["NATUREZA"] ?? "").trim()
      if (natureza) values.add(natureza)
    }
    return NATUREZA_OPTIONS.filter((option) => values.has(option)).concat(
      Array.from(values).filter((value) => !NATUREZA_OPTIONS.includes(value)),
    )
  }, [nfsRows])

  const availableConsolidadoNaturezas = useMemo(() => {
    const values = new Set<string>()
    for (const row of consolidadoRows) {
      const natureza = String(row["NATUREZA"] ?? "").trim()
      if (natureza) values.add(natureza)
    }
    return NATUREZA_OPTIONS.filter((option) => values.has(option)).concat(
      Array.from(values).filter((value) => !NATUREZA_OPTIONS.includes(value)),
    )
  }, [consolidadoRows])

  const handleSort = (current: SortState, setSort: (next: SortState) => void, key: string) => {
    setSort({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    })
  }

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/export/${sessionId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "custos_export.xlsx"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      console.error("Erro ao exportar custos", exportError)
    }
  }

  if (loading) {
    return <div style={{ color: "#cbd5e1" }}>Carregando dashboard de custos...</div>
  }

  if (error || (nfsRows.length === 0 && consolidadoRows.length === 0 && resumoRows.length === 0)) {
    return (
      <EmptyState
        schemaRequired="custos"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.custos}
        uploadedSchemas={schemaTypes}
      />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, color: "#f8fafc" }}>Custos</h2>
        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
          NFs, consolidado, orçamento realizado e resumo financeiro do arquivo enviado.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonStyle,
              background: activeTab === tab.id ? "#cbbba0" : "#1e293b",
              color: activeTab === tab.id ? "#0b4f3a" : "#f8fafc",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "nfs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            <Card label="Total NFs" value={nfsKpis.totalNfs.toLocaleString("pt-BR")} />
            <Card label="Valor Total" value={formatCurrency(nfsKpis.totalValor)} />
            <Card label="Valor em Aberto" value={formatCurrency(nfsKpis.valorEmAberto)} />
            <Card label="Nº de Fornecedores" value={nfsKpis.fornecedores.toLocaleString("pt-BR")} />
          </div>

          <section style={panelStyle}>
            <div style={filterRowStyle}>
              <select
                multiple
                value={selectedNaturezas}
                onChange={(event) => {
                  setSelectedNaturezas(Array.from(event.target.selectedOptions, (option) => option.value))
                  setNfsPage(1)
                }}
                style={{ ...inputStyle, minHeight: 120 }}
              >
                {availableNaturezas.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={fornecedorSearch}
                onChange={(event) => {
                  setFornecedorSearch(event.target.value)
                  setNfsPage(1)
                }}
                placeholder="Buscar fornecedor"
                style={inputStyle}
              />
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
            </div>

            <h3 style={panelTitleStyle}>Valor por Natureza</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={naturezaChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="natureza" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                  {naturezaChart.map((entry) => (
                    <Cell key={entry.natureza} fill={NATUREZA_COLORS[entry.natureza] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Tabela de NFs</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "Nº CONSOLIDADO",
                      "COD",
                      "FORNECEDOR",
                      "NF",
                      "MAPA PREÇOS",
                      "NATUREZA",
                      "BOLETO/DEPÓSITO",
                      "DATA VENCTO",
                      "VALOR",
                      "SITUAÇÃO PLANILHA",
                      "SALDO PLANILHA",
                    ].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(nfsSort, setNfsSort, column)} style={sortButtonStyle}>
                          {column}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedNfs.rows.map((row, index) => (
                    <tr key={`${row["NF"]}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      {[
                        "Nº CONSOLIDADO",
                        "COD",
                        "FORNECEDOR",
                        "NF",
                        "MAPA PREÇOS",
                        "NATUREZA",
                        "BOLETO/DEPÓSITO",
                        "DATA VENCTO",
                        "VALOR",
                        "SITUAÇÃO PLANILHA",
                        "SALDO PLANILHA",
                      ].map((column) => (
                        <td key={column} style={tdStyle}>
                          {column === "VALOR" || column === "SALDO PLANILHA"
                            ? formatCurrency(parseNumber(row[column]))
                            : String(row[column] ?? "-")}
                        </td>
                      ))}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            <Card label="Total Pagamentos" value={consolidadoKpis.totalPagamentos.toLocaleString("pt-BR")} />
            <Card label="Valor Total" value={formatCurrency(consolidadoKpis.totalValor)} />
            <Card label="Valor Apropriado Total" value={formatCurrency(consolidadoKpis.valorApropriado)} />
          </div>

          <section style={panelStyle}>
            <div style={filterRowStyle}>
              <select
                multiple
                value={selectedConsolidadoNaturezas}
                onChange={(event) => {
                  setSelectedConsolidadoNaturezas(Array.from(event.target.selectedOptions, (option) => option.value))
                  setConsolidadoPage(1)
                }}
                style={{ ...inputStyle, minHeight: 120 }}
              >
                {availableConsolidadoNaturezas.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={consolidadoFornecedorSearch}
                onChange={(event) => {
                  setConsolidadoFornecedorSearch(event.target.value)
                  setConsolidadoPage(1)
                }}
                placeholder="Buscar fornecedor"
                style={inputStyle}
              />
            </div>

            <h3 style={panelTitleStyle}>Tabela Consolidada</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "Nº CONSOLIDADO",
                      "FORNECEDOR",
                      "NF",
                      "MAPA",
                      "NATUREZA",
                      "COND.PAGTO",
                      "DATA VENCTO",
                      "VALOR",
                      "ITEM APROPRIAÇÃO",
                      "VALOR APROPRIADO",
                    ].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(consolidadoSort, setConsolidadoSort, column)} style={sortButtonStyle}>
                          {column}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedConsolidado.rows.map((row, index) => (
                    <tr key={`${row["NF"]}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      {[
                        "Nº CONSOLIDADO",
                        "FORNECEDOR",
                        "NF",
                        "MAPA",
                        "NATUREZA",
                        "COND.PAGTO",
                        "DATA VENCTO",
                        "VALOR",
                        "ITEM APROPRIAÇÃO",
                        "VALOR APROPRIADO",
                      ].map((column) => (
                        <td key={column} style={tdStyle}>
                          {column === "VALOR" || column === "VALOR APROPRIADO"
                            ? formatCurrency(parseNumber(row[column]))
                            : String(row[column] ?? "-")}
                        </td>
                      ))}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={panelStyle}>
            <div style={filterRowStyle}>
              <select value={selectedOrcadoItem?.item ?? ""} onChange={(event) => setSelectedItem(event.target.value)} style={inputStyle}>
                {orcadoRealizadoRows.map((row) => (
                  <option key={row.item} value={row.item}>
                    {row.item} - {row.descricao}
                  </option>
                ))}
              </select>
            </div>

            <h3 style={panelTitleStyle}>Verba × Desembolso por Período</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={orcadoChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="periodo" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Line type="monotone" dataKey="verba" stroke="#cbbba0" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="desembolso" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Resumo de Itens</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["item", "descricao", "verba_total", "desembolso_total", "saldo"].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(orcadoSort, setOrcadoSort, column)} style={sortButtonStyle}>
                          {column.replace(/_/g, " ").toUpperCase()}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedOrcadoSummary.map((row, index) => (
                    <tr key={`${row.item}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      <td style={tdStyle}>{String(row.item)}</td>
                      <td style={tdStyle}>{String(row.descricao)}</td>
                      <td style={tdStyle}>{formatCurrency(parseNumber(row.verba_total))}</td>
                      <td style={tdStyle}>{formatCurrency(parseNumber(row.desembolso_total))}</td>
                      <td style={{ ...tdStyle, color: parseNumber(row.saldo) < 0 ? "#f87171" : "#4ade80", fontWeight: 800 }}>
                        {formatCurrency(parseNumber(row.saldo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "resumo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Card label="TOTAL GERAL" value={formatCurrency(resumoKpis.totalGeral)} />
            <Card label="TAXA ADMINISTRAÇÃO" value={formatCurrency(resumoKpis.taxaAdministracao)} />
          </div>

          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h3 style={{ ...panelTitleStyle, margin: 0 }}>Resumo Consolidado</h3>
              <button type="button" onClick={handleExport} style={primaryButtonStyle}>
                Exportar
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "Nº CONSOLIDADO",
                      "MATERIAL/SERVIÇO",
                      "MÃO OBRA EMPREITADA",
                      "MÃO OBRA TEMPO",
                      "STAFF",
                      "SERVIÇO sem TAXA ADM",
                      "TOTAL",
                      "TAXA ADMINISTRAÇÃO",
                      "DATA VENCTO",
                      "DATA RECBTO",
                      "TOTAL GERAL",
                    ].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(resumoSort, setResumoSort, column)} style={sortButtonStyle}>
                          {column}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedResumo.rows.map((row, index) => (
                    <tr key={`${row["Nº CONSOLIDADO"]}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      {[
                        "Nº CONSOLIDADO",
                        "MATERIAL/SERVIÇO",
                        "MÃO OBRA EMPREITADA",
                        "MÃO OBRA TEMPO",
                        "STAFF",
                        "SERVIÇO sem TAXA ADM",
                        "TOTAL",
                        "TAXA ADMINISTRAÇÃO",
                        "DATA VENCTO",
                        "DATA RECBTO",
                        "TOTAL GERAL",
                      ].map((column) => (
                        <td key={column} style={tdStyle}>
                          {column.includes("SERVIÇO") ||
                          column.includes("MÃO") ||
                          column === "STAFF" ||
                          column === "TOTAL" ||
                          column === "TAXA ADMINISTRAÇÃO" ||
                          column === "TOTAL GERAL"
                            ? formatCurrency(parseNumber(row[column]))
                            : String(row[column] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedResumo.page} totalPages={pagedResumo.totalPages} onChange={setResumoPage} />
          </section>
        </div>
      )}
    </div>
  )
}

const tabButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(203,187,160,0.28)",
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
}

const metricCardStyle: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: 16,
  border: "1px solid rgba(203,187,160,0.18)",
  padding: "18px 16px",
}

const panelStyle: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: 20,
  border: "1px solid rgba(203,187,160,0.18)",
  padding: 18,
}

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 18,
  fontWeight: 800,
  color: "#f8fafc",
}

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.26)",
  padding: "10px 12px",
  background: "#0f172a",
  color: "#f8fafc",
  minWidth: 180,
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  fontSize: 12,
  color: "#94a3b8",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
}

const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 14,
  color: "#f8fafc",
  borderBottom: "1px solid rgba(148,163,184,0.12)",
  whiteSpace: "nowrap",
}

const sortButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
}

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(203,187,160,0.28)",
  background: "#cbbba0",
  color: "#0b4f3a",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(203,187,160,0.22)",
  background: "#0f172a",
  color: "#f8fafc",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
}
