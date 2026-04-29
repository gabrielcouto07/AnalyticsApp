"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { fetchApiJson, type OrcamentoFlatResponse, type OrcamentoMapasResponse } from "../api/analytics"
import { EmptyState } from "./layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "./layout/schemaRequirements"
import { useSessionStore } from "../store/session"

type TabId = "linhas" | "mapas"
type SortDirection = "asc" | "desc"
type SortState = { key: string; direction: SortDirection }
type TableRow = Record<string, string | number | null | undefined>

const PAGE_SIZE = 50

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

function compareValues(left: unknown, right: unknown) {
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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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

export const OrcamentoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("linhas")
  const [flatRows, setFlatRows] = useState<OrcamentoFlatResponse>([])
  const [mapasRows, setMapasRows] = useState<OrcamentoMapasResponse>([])
  const [descricaoSearch, setDescricaoSearch] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [flatSort, setFlatSort] = useState<SortState>({ key: "ITEM", direction: "asc" })
  const [mapasSort, setMapasSort] = useState<SortState>({ key: "VALOR_MAPA", direction: "desc" })
  const [flatPage, setFlatPage] = useState(1)
  const [mapasPage, setMapasPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<OrcamentoFlatResponse>(`/api/orcamento/${sessionId}/flat`),
      fetchApiJson<OrcamentoMapasResponse>(`/api/orcamento/${sessionId}/mapas`),
    ])
      .then(([nextFlat, nextMapas]) => {
        if (!active) return
        setFlatRows(nextFlat)
        setMapasRows(nextMapas)
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar dados de orçamento.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const filteredFlat = useMemo(() => {
    return flatRows.filter((row) => {
      const descricao = String(row["DESCRIÇÃO"] ?? "")
      return !descricaoSearch || normalizeText(descricao).includes(normalizeText(descricaoSearch))
    })
  }, [descricaoSearch, flatRows])

  const filteredMapas = useMemo(() => {
    return mapasRows.filter((row) => {
      const item = String(row.ITEM ?? "")
      return selectedItems.length === 0 || selectedItems.includes(item)
    })
  }, [mapasRows, selectedItems])

  const totalOrcamento = useMemo(
    () => filteredFlat.reduce((sum, row) => sum + parseNumber(row["CUSTO TOTAL"]), 0),
    [filteredFlat],
  )

  const topMapasChart = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredMapas) {
      const mapa = String(row.MAPA ?? "")
      grouped.set(mapa, (grouped.get(mapa) ?? 0) + parseNumber(row.VALOR_MAPA))
    }
    return Array.from(grouped.entries())
      .map(([mapa, valor]) => ({ mapa, valor }))
      .sort((left, right) => right.valor - left.valor)
      .slice(0, 15)
  }, [filteredMapas])

  const itemOptions = useMemo(() => {
    return Array.from(new Set(mapasRows.map((row) => String(row.ITEM ?? "").trim()).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }),
    )
  }, [mapasRows])

  const sortedFlat = useMemo(() => sortRows(filteredFlat as TableRow[], flatSort), [filteredFlat, flatSort])
  const sortedMapas = useMemo(() => sortRows(filteredMapas as TableRow[], mapasSort), [filteredMapas, mapasSort])
  const pagedFlat = paginateRows(sortedFlat, flatPage)
  const pagedMapas = paginateRows(sortedMapas, mapasPage)

  const handleSort = (current: SortState, setSort: (next: SortState) => void, key: string) => {
    setSort({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    })
  }

  if (loading) {
    return <div style={{ color: "#cbd5e1" }}>Carregando dashboard de orçamento...</div>
  }

  if (error || (flatRows.length === 0 && mapasRows.length === 0)) {
    return (
      <EmptyState
        schemaRequired="orcamento"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.orcamento}
        uploadedSchemas={schemaTypes}
      />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, color: "#f8fafc" }}>Orçamento</h2>
        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
          Linhas orçamentárias e mapas de compra derivados do arquivo enviado.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { id: "linhas" as const, label: "Linhas de Orçamento" },
          { id: "mapas" as const, label: "Mapas de Compra" },
        ].map((tab) => (
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

      {activeTab === "linhas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", gap: 12 }}>
            <div style={metricCardStyle}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Orçamento Total</div>
              <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>{formatCurrency(totalOrcamento)}</div>
            </div>
          </div>

          <section style={panelStyle}>
            <div style={filterRowStyle}>
              <input
                type="text"
                value={descricaoSearch}
                onChange={(event) => {
                  setDescricaoSearch(event.target.value)
                  setFlatPage(1)
                }}
                placeholder="Filtrar por descrição"
                style={inputStyle}
              />
            </div>

            <h3 style={panelTitleStyle}>Tabela de Linhas</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["ITEM", "SUBITEM", "DESCRIÇÃO", "UNID", "QTD", "CUSTO UNITÁRIO", "CUSTO TOTAL"].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(flatSort, setFlatSort, column)} style={sortButtonStyle}>
                          {column}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedFlat.rows.map((row, index) => (
                    <tr key={`${row.ITEM}-${row.SUBITEM}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      {["ITEM", "SUBITEM", "DESCRIÇÃO", "UNID", "QTD", "CUSTO UNITÁRIO", "CUSTO TOTAL"].map((column) => (
                        <td key={column} style={tdStyle}>
                          {column === "QTD"
                            ? parseNumber(row[column]).toLocaleString("pt-BR")
                            : column === "CUSTO UNITÁRIO" || column === "CUSTO TOTAL"
                              ? formatCurrency(parseNumber(row[column]))
                              : String(row[column] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedFlat.page} totalPages={pagedFlat.totalPages} onChange={setFlatPage} />
          </section>
        </div>
      )}

      {activeTab === "mapas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={panelStyle}>
            <div style={filterRowStyle}>
              <select
                multiple
                value={selectedItems}
                onChange={(event) => {
                  setSelectedItems(Array.from(event.target.selectedOptions, (option) => option.value))
                  setMapasPage(1)
                }}
                style={{ ...inputStyle, minHeight: 120 }}
              >
                {itemOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <h3 style={panelTitleStyle}>Top 15 Mapas por Valor</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topMapasChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="mapa" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="valor" fill="#cbbba0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Tabela de Mapas</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["ITEM", "SUBITEM", "MAPA", "VALOR_MAPA"].map((column) => (
                      <th key={column} style={thStyle}>
                        <button type="button" onClick={() => handleSort(mapasSort, setMapasSort, column)} style={sortButtonStyle}>
                          {column}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedMapas.rows.map((row, index) => (
                    <tr key={`${row.ITEM}-${row.MAPA}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.28)" : "transparent" }}>
                      <td style={tdStyle}>{String(row.ITEM ?? "-")}</td>
                      <td style={tdStyle}>{String(row.SUBITEM ?? "-")}</td>
                      <td style={tdStyle}>{String(row.MAPA ?? "-")}</td>
                      <td style={tdStyle}>{formatCurrency(parseNumber(row.VALOR_MAPA))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedMapas.page} totalPages={pagedMapas.totalPages} onChange={setMapasPage} />
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
  minWidth: 220,
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
}

const sortButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
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
