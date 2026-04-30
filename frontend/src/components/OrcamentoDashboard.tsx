"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { fetchApiJson } from "../api/analytics"

type TabId = "linhas" | "mapas" | "orcado-realizado"
type GenericRow = Record<string, unknown>
type OrcadoRealizadoItem = {
  item: string
  descricao: string
  verba_total: number
  periodos: Array<{ periodo: number; desembolso: number }>
}

const PAGE_SIZE = 50

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={cardSkeletonStyle} />
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

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0
  const cleaned = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function findColumn(rows: GenericRow[], candidates: string[]) {
  const keys = Object.keys(rows[0] ?? {})
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate)
    const exact = keys.find((key) => normalizeText(key) === normalizedCandidate)
    if (exact) return exact
  }
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate)
    const partial = keys.find((key) => normalizeText(key).includes(normalizedCandidate))
    if (partial) return partial
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

export const OrcamentoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("linhas")
  const [flatRows, setFlatRows] = useState<GenericRow[]>([])
  const [mapasRows, setMapasRows] = useState<GenericRow[]>([])
  const [orcadoRealizadoRows, setOrcadoRealizadoRows] = useState<OrcadoRealizadoItem[]>([])
  const [descricaoSearch, setDescricaoSearch] = useState("")
  const [selectedBudgetItem, setSelectedBudgetItem] = useState("all")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [flatPage, setFlatPage] = useState(1)
  const [mapasPage, setMapasPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<GenericRow[]>(`/api/orcamento/${sessionId}/flat`),
      fetchApiJson<GenericRow[]>(`/api/orcamento/${sessionId}/mapas`),
      fetchApiJson<OrcadoRealizadoItem[]>(`/api/custos/${sessionId}/orcado_realizado`).catch(() => []),
    ])
      .then(([nextFlat, nextMapas, nextOrcadoRealizado]) => {
        if (!active) return
        setFlatRows(nextFlat)
        setMapasRows(nextMapas)
        setOrcadoRealizadoRows(nextOrcadoRealizado)
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar dados de orcamento.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const flatColumns = useMemo(() => {
    return {
      item: findColumn(flatRows, ["ITEM"]),
      subitem: findColumn(flatRows, ["SUBITEM"]),
      descricao: findColumn(flatRows, ["DESCRICAO", "Descricao", "DESCRIÇÃO"]),
      unid: findColumn(flatRows, ["UNID"]),
      qtd: findColumn(flatRows, ["QTD"]),
      custoUnitario: findColumn(flatRows, ["CUSTO UNITARIO", "CustoUnitario", "CUSTO UNITÁRIO"]),
      custoTotal: findColumn(flatRows, ["CUSTO TOTAL", "CustoTotal"]),
    }
  }, [flatRows])

  const mapaColumns = useMemo(() => {
    return {
      item: findColumn(mapasRows, ["ITEM"]),
      subitem: findColumn(mapasRows, ["SUBITEM"]),
      mapa: findColumn(mapasRows, ["MAPA"]),
      valorMapa: findColumn(mapasRows, ["VALOR_MAPA", "ValorMapa"]),
    }
  }, [mapasRows])

  const filteredFlat = useMemo(() => {
    return flatRows.filter((row) => {
      const descricao = String(getValue(row, flatColumns.descricao) ?? "")
      const item = String(getValue(row, flatColumns.item) ?? "").trim()
      const matchesSearch = !descricaoSearch || normalizeText(descricao).includes(normalizeText(descricaoSearch))
      const matchesItem = selectedBudgetItem === "all" || item === selectedBudgetItem
      return matchesSearch && matchesItem
    })
  }, [descricaoSearch, flatColumns.descricao, flatColumns.item, flatRows, selectedBudgetItem])

  const filteredMapas = useMemo(() => {
    return mapasRows.filter((row) => {
      const item = String(getValue(row, mapaColumns.item) ?? "").trim()
      return selectedItems.length === 0 || selectedItems.includes(item)
    })
  }, [mapaColumns.item, mapasRows, selectedItems])

  const totalOrcamento = useMemo(() => {
    const totalColumn =
      Object.keys(flatRows[0] ?? {}).find((key) => {
        const normalized = normalizeText(key)
        return normalized.includes("custo") && normalized.includes("total")
      }) ?? flatColumns.custoTotal
    return filteredFlat.reduce((sum, row) => sum + parseNumber(getValue(row, totalColumn)), 0)
  }, [filteredFlat, flatColumns.custoTotal, flatRows])

  const budgetItemOptions = useMemo(() => {
    return Array.from(
      new Set(
        flatRows
          .map((row) => String(getValue(row, flatColumns.item) ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }))
  }, [flatColumns.item, flatRows])

  const flatSummary = useMemo(() => {
    const itemCount = filteredFlat.length
    const custoMedio = itemCount > 0 ? totalOrcamento / itemCount : 0
    return {
      verbaTotal: totalOrcamento,
      itensOrcados: itemCount,
      custoMedio,
    }
  }, [filteredFlat.length, totalOrcamento])

  const itemOptions = useMemo(() => {
    return Array.from(
      new Set(
        mapasRows
          .map((row) => String(getValue(row, mapaColumns.item) ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }))
  }, [mapaColumns.item, mapasRows])

  const mapasChartRows = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredMapas) {
      const mapa = String(getValue(row, mapaColumns.mapa) ?? "").trim()
      if (!mapa) continue
      grouped.set(mapa, (grouped.get(mapa) ?? 0) + parseNumber(getValue(row, mapaColumns.valorMapa)))
    }
    return Array.from(grouped.entries())
      .map(([mapa, valor]) => ({ mapa, valor }))
      .sort((left, right) => right.valor - left.valor)
      .slice(0, 15)
  }, [filteredMapas, mapaColumns.mapa, mapaColumns.valorMapa])

  const pagedFlat = paginateRows(filteredFlat, flatPage)
  const pagedMapas = paginateRows(filteredMapas, mapasPage)

  if (loading) return <DashboardSkeleton />

  if (error) {
    return <EmptyTabMessage message={error} />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Orcamento</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Linhas orcamentarias e mapas de compra derivados do arquivo enviado.
        </p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 8, gap: 16 }}>
        {[
          { id: "linhas" as const, label: "Linhas de Orcamento" },
          { id: "mapas" as const, label: "Mapas de Compra" },
          { id: "orcado-realizado" as const, label: "Orcado x Realizado" },
        ].map((tab) => (
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

      {activeTab === "linhas" && (
        flatRows.length === 0 ? (
          <EmptyTabMessage message="Dados de Orcamento nao disponiveis neste arquivo." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {[
                { label: "Verba Total", value: formatCurrency(flatSummary.verbaTotal) },
                { label: "Itens Orcados", value: flatSummary.itensOrcados.toLocaleString("pt-BR") },
                { label: "Custo Medio por Item", value: formatCurrency(flatSummary.custoMedio) },
              ].map((card) => (
                <div key={card.label} style={metricCardStyle}>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                    {card.label}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0b4f3a" }}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div style={filterPanelStyle}>
              <label style={filterLabelStyle}>
                Buscar
                <input
                  type="text"
                  value={descricaoSearch}
                  onChange={(event) => {
                    setDescricaoSearch(event.target.value)
                    setFlatPage(1)
                  }}
                  placeholder="Buscar por descricao..."
                  style={filterInputStyle}
                />
              </label>
              <label style={filterLabelStyle}>
                Item
                <select
                  value={selectedBudgetItem}
                  onChange={(event) => {
                    setSelectedBudgetItem(event.target.value)
                    setFlatPage(1)
                  }}
                  style={budgetSelectStyle}
                >
                  <option value="all">Todos os itens</option>
                  {budgetItemOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setDescricaoSearch("")
                  setSelectedBudgetItem("all")
                  setFlatPage(1)
                }}
                style={resetButtonStyle}
              >
                Limpar Filtros
              </button>
            </div>

            <p style={{ margin: "-4px 0 0", color: "#64748b", fontSize: 13 }}>
              Exibindo {filteredFlat.length.toLocaleString("pt-BR")} de {flatRows.length.toLocaleString("pt-BR")} itens
            </p>

            <section style={panelStyle}>
              <h3 style={panelTitleStyle}>Tabela de Linhas</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        flatColumns.item,
                        flatColumns.subitem,
                        flatColumns.descricao,
                        flatColumns.unid,
                        flatColumns.qtd,
                        flatColumns.custoUnitario,
                        flatColumns.custoTotal,
                      ]
                        .filter(Boolean)
                        .map((column) => (
                          <th key={column} style={thStyle}>
                            {column}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedFlat.rows.map((row, index) => (
                      <tr key={`${String(getValue(row, flatColumns.item) ?? "")}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}>
                        {[flatColumns.item, flatColumns.subitem, flatColumns.descricao, flatColumns.unid].map((column) => (
                          <td key={String(column)} style={tdStyle}>
                            {String(getValue(row, column) ?? "-")}
                          </td>
                        ))}
                        <td style={{ ...tdStyle, textAlign: "right" }}>{parseNumber(getValue(row, flatColumns.qtd)).toLocaleString("pt-BR")}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(parseNumber(getValue(row, flatColumns.custoUnitario)))}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                          {formatCurrency(parseNumber(getValue(row, flatColumns.custoTotal)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagedFlat.page} totalPages={pagedFlat.totalPages} onChange={setFlatPage} />
            </section>
          </div>
        )
      )}

      {activeTab === "mapas" && (
        mapasRows.length === 0 ? (
          <EmptyTabMessage message="Mapas de Compra nao disponiveis neste arquivo." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={filterPanelStyle}>
              <label style={filterLabelStyle}>
                ITEM
                <select
                  multiple
                  value={selectedItems}
                  onChange={(event) => {
                    setSelectedItems(Array.from(event.target.selectedOptions, (option) => option.value))
                    setMapasPage(1)
                  }}
                  style={filterSelectStyle}
                >
                  {itemOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedItems([])
                  setMapasPage(1)
                }}
                style={resetButtonStyle}
              >
                Limpar Filtros
              </button>
            </div>

            <section style={panelStyle}>
              <h3 style={panelTitleStyle}>Top 15 Mapas por Valor</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={mapasChartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mapa" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value: number) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="valor" fill="#0b4f3a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={panelStyle}>
              <h3 style={panelTitleStyle}>Tabela de Mapas</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[mapaColumns.item, mapaColumns.subitem, mapaColumns.mapa, mapaColumns.valorMapa]
                        .filter(Boolean)
                        .map((column) => (
                          <th key={column} style={thStyle}>
                            {column}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMapas.rows.map((row, index) => (
                      <tr key={`${String(getValue(row, mapaColumns.mapa) ?? "")}-${index}`} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}>
                        <td style={tdStyle}>{String(getValue(row, mapaColumns.item) ?? "-")}</td>
                        <td style={tdStyle}>{String(getValue(row, mapaColumns.subitem) ?? "-")}</td>
                        <td style={tdStyle}>{String(getValue(row, mapaColumns.mapa) ?? "-")}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                          {formatCurrency(parseNumber(getValue(row, mapaColumns.valorMapa)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagedMapas.page} totalPages={pagedMapas.totalPages} onChange={setMapasPage} />
            </section>
          </div>
        )
      )}

      {activeTab === "orcado-realizado" && (
        orcadoRealizadoRows.length === 0 ? (
          <section style={emptyStatePanelStyle}>
            <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 12 }}>📊</div>
            <h3 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 800 }}>
              Orcado × Realizado indisponivel
            </h3>
            <p style={{ margin: "10px 0 0", maxWidth: 420, color: "#64748b", fontSize: 14 }}>
              Este workbook nao contem a planilha ORCADOxREALIZADO ou ela esta vazia.
            </p>
          </section>
        ) : (
          <section style={panelStyle}>
            <h3 style={panelTitleStyle}>Orcado x Realizado</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["ITEM", "DESCRICAO", "VERBA TOTAL", "PERIODOS"].map((column) => (
                      <th key={column} style={thStyle}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orcadoRealizadoRows.map((row) => (
                    <tr key={`${row.item}-${row.descricao}`}>
                      <td style={tdStyle}>{row.item}</td>
                      <td style={tdStyle}>{row.descricao}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                        {formatCurrency(Number(row.verba_total || 0))}
                      </td>
                      <td style={tdStyle}>{row.periodos.length.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}
    </div>
  )
}

const skeletonStyle = `
  @keyframes orcamento-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const cardSkeletonStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "orcamento-wave 1.4s ease infinite",
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
  width: "100%",
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 12px",
  fontSize: 13,
}

const filterSelectStyle: React.CSSProperties = {
  ...filterInputStyle,
  minHeight: 96,
}

const budgetSelectStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 12px",
  fontSize: 13,
  minWidth: 180,
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

const emptyStatePanelStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 48,
  color: "#64748b",
  background: "#f8fafc",
  border: "1px dashed rgba(11,79,58,0.18)",
  borderRadius: 14,
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
