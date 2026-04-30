"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchApiJson } from "../api/analytics"
import { formatBRL, formatInt, fmtPct } from "../lib/formatters"
import { SchemaGuard } from "./SchemaGuard"

type TabId = "orcamento" | "orcado-realizado"
type GenericRow = Record<string, unknown>
type OrcadoRealizadoItem = {
  item: string
  descricao: string
  verba_total: number
  periodos: Array<{ periodo: number; desembolso: number }>
}

const BRAND_GREEN = "#0b4f3a"
const BRAND_GREEN_DARK = "#08382a"
const ACCENT_BLUE = "#4f8ef7"
const ACCENT_AMBER = "#f5a623"
const ACCENT_RED = "#ef4444"
const ACCENT_GREEN = "#34c97e"

const PANEL: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.10)",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 12px rgba(11,79,58,0.07)",
  fontFamily: "'Inter', system-ui, sans-serif",
}

const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "orcamento", label: "Orçamento" },
  { id: "orcado-realizado", label: "Orçado × Realizado" },
]

const PAGE_SIZE = 50

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return formatBRL(value)
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function paginate<T>(rows: T[], page: number) {
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

function CustomTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(11,79,58,0.15)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{label}</p>
      {payload.map((entry) => (
        <div key={`${entry.name}-${entry.value}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: entry.color ?? ACCENT_BLUE,
              display: "inline-block",
            }}
          />
          <span style={{ color: "#475569", fontWeight: 600 }}>{entry.name}</span>
          <span style={{ marginLeft: "auto", color: "#0f172a", fontWeight: 700 }}>
            {typeof entry.value === "number" ? formatCurrency(entry.value) : String(entry.value ?? "-")}
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <section
      style={{
        ...PANEL,
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 46, lineHeight: 1, marginBottom: 14 }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
      <p style={{ margin: "10px 0 0", maxWidth: 360, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{message}</p>
    </section>
  )
}

function Skeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      style={{
        ...PANEL,
        height,
        background: "linear-gradient(90deg, rgba(226,232,240,0.9), rgba(241,245,249,0.98), rgba(226,232,240,0.9))",
        backgroundSize: "200% 100%",
        animation: "orcamento-wave 1.4s ease infinite",
      }}
    />
  )
}

export const OrcamentoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState<TabId>("orcamento")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flatRows, setFlatRows] = useState<GenericRow[]>([])
  const [orcadoRealizadoRows, setOrcadoRealizadoRows] = useState<OrcadoRealizadoItem[]>([])
  const [descricaoSearch, setDescricaoSearch] = useState("")
  const [selectedItem, setSelectedItem] = useState("all")
  const [sortState, setSortState] = useState<{ key: "QTD" | "CUSTO TOTAL"; direction: "asc" | "desc" }>({
    key: "CUSTO TOTAL",
    direction: "desc",
  })
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchApiJson<GenericRow[]>(`/api/orcamento/${sessionId}/flat`).catch(() => []),
      fetchApiJson<OrcadoRealizadoItem[]>(`/api/custos/${sessionId}/orcado_realizado`).catch(() => []),
    ])
      .then(([nextFlat, nextOrcadoRealizado]) => {
        if (!active) return
        setFlatRows(nextFlat)
        setOrcadoRealizadoRows(nextOrcadoRealizado)
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

  const itemOptions = useMemo(
    () =>
      Array.from(new Set(flatRows.map((row) => String(row["ITEM"] ?? "").trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR", { numeric: true }),
      ),
    [flatRows],
  )

  const filteredRows = useMemo(() => {
    const filtered = flatRows.filter((row) => {
      const descricao = String(row["DESCRIÇÃO"] ?? "")
      const item = String(row["ITEM"] ?? "").trim()
      const matchesSearch = !descricaoSearch || normalizeText(descricao).includes(normalizeText(descricaoSearch))
      const matchesItem = selectedItem === "all" || item === selectedItem
      return matchesSearch && matchesItem
    })
    return [...filtered].sort((left, right) => {
      const comparison = parseNumber(left[sortState.key]) - parseNumber(right[sortState.key])
      return sortState.direction === "asc" ? comparison : -comparison
    })
  }, [descricaoSearch, flatRows, selectedItem, sortState.direction, sortState.key])

  const budgetSummary = useMemo(() => {
    const verbaTotal = filteredRows.reduce((sum, row) => sum + parseNumber(row["CUSTO TOTAL"]), 0)
    const itensOrcados = filteredRows.length
    return {
      verbaTotal,
      itensOrcados,
      custoMedio: itensOrcados > 0 ? verbaTotal / itensOrcados : 0,
    }
  }, [filteredRows])

  const pageData = paginate(filteredRows, page)

  const varianceRows = useMemo(() => {
    return orcadoRealizadoRows.map((row) => {
      const realizado = row.periodos.reduce((sum, periodo) => sum + Number(periodo.desembolso || 0), 0)
      const variancia = realizado - row.verba_total
      const consumido = row.verba_total > 0 ? (realizado / row.verba_total) * 100 : 0
      return {
        item: row.item,
        descricao: row.descricao,
        orcado: row.verba_total,
        realizado,
        variancia,
        consumido,
      }
    })
  }, [orcadoRealizadoRows])

  const varianceChartData = useMemo(
    () =>
      varianceRows.slice(0, 12).map((row) => ({
        item: row.item,
        orçado: row.orcado,
        realizado: row.realizado,
      })),
    [varianceRows],
  )

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} height={110} />
          ))}
        </div>
        <Skeleton height={88} />
        <Skeleton height={320} />
        <style>{`
          @keyframes orcamento-wave {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return <EmptyState icon="⚠" title="Erro ao carregar orçamento" message={error} />
  }

  return (
    <SchemaGuard requires={["orcamento", "custos"]}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Orçamento</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          Linhas orçadas e comparação com o realizado para acompanhar consumo de verba.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid #dbe4ea", overflowX: "auto" }}>
        {TAB_LABELS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: "transparent",
                borderBottom: isActive ? `3px solid ${BRAND_GREEN}` : "3px solid transparent",
                color: isActive ? BRAND_GREEN : "#64748b",
                padding: "0 4px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "orcamento" && (
        flatRows.length === 0 ? (
          <EmptyState icon="📋" title="Linhas de orçamento indisponíveis" message="Este arquivo não trouxe uma aba de orçamento com ITEM, DESCRIÇÃO e CUSTO TOTAL." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
              {[
                { label: "Verba Total", value: formatCurrency(budgetSummary.verbaTotal), color: ACCENT_GREEN },
                { label: "Itens Orçados", value: formatInt(budgetSummary.itensOrcados), color: ACCENT_BLUE },
                { label: "Custo Médio/Item", value: formatCurrency(budgetSummary.custoMedio), color: ACCENT_AMBER },
              ].map((card) => (
                <div key={card.label} style={{ ...PANEL, borderTop: `3px solid ${card.color}` }}>
                  <p style={labelStyle}>{card.label}</p>
                  <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{card.value}</p>
                </div>
              ))}
            </div>

            <section style={PANEL}>
              <div style={filterRowStyle}>
                <label style={filterLabelStyle}>
                  Buscar descrição
                  <input
                    value={descricaoSearch}
                    onChange={(event) => {
                      setDescricaoSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Buscar item..."
                    style={{ ...inputStyle, width: 260 }}
                  />
                </label>
                <label style={filterLabelStyle}>
                  ITEM
                  <select
                    value={selectedItem}
                    onChange={(event) => {
                      setSelectedItem(event.target.value)
                      setPage(1)
                    }}
                    style={{ ...inputStyle, width: 180 }}
                  >
                    <option value="all">Todos</option>
                    {itemOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => {
                    setDescricaoSearch("")
                    setSelectedItem("all")
                    setPage(1)
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = BRAND_GREEN_DARK
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = BRAND_GREEN
                  }}
                >
                  Limpar
                </button>
              </div>
            </section>

            <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              Exibindo {filteredRows.length} de {flatRows.length} itens
            </p>

            <section style={PANEL}>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["ITEM", "SUBITEM", "DESCRIÇÃO", "UNID", "QTD", "CUSTO UNITÁRIO", "CUSTO TOTAL"].map((column) => (
                        <th
                          key={column}
                          style={thStyle}
                          onClick={() => {
                            if (column !== "QTD" && column !== "CUSTO TOTAL") return
                            setSortState((current) => ({
                              key: column,
                              direction: current.key === column && current.direction === "asc" ? "desc" : "asc",
                            }))
                          }}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.rows.map((row, index) => {
                      const zeroTotal = parseNumber(row["CUSTO TOTAL"]) === 0
                      return (
                        <tr key={`${String(row["ITEM"] ?? "")}-${index}`} style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb", opacity: zeroTotal ? 0.5 : 1 }}>
                          <td style={tdStyle}>{String(row["ITEM"] ?? "-")}</td>
                          <td style={tdStyle}>{String(row["SUBITEM"] ?? "-")}</td>
                          <td style={tdStyle}>{String(row["DESCRIÇÃO"] ?? "-")}</td>
                          <td style={tdStyle}>{String(row["UNID"] ?? "-")}</td>
                          <td style={{ ...tdStyle, ...numberCellStyle }}>{formatInt(parseNumber(row["QTD"]))}</td>
                          <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(parseNumber(row["CUSTO UNITÁRIO"]))}</td>
                          <td style={{ ...tdStyle, ...numberCellStyle, fontWeight: 800, color: ACCENT_GREEN }}>
                            {formatCurrency(parseNumber(row["CUSTO TOTAL"]))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination pageData={pageData} total={filteredRows.length} onChange={setPage} />
            </section>
          </div>
        )
      )}

      {activeTab === "orcado-realizado" && (
        varianceRows.length === 0 ? (
          <EmptyState
            icon="📊"
            title="Orçado × Realizado indisponível"
            message="Este workbook não contém a planilha ORÇADOxREALIZADO preenchida."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section style={PANEL}>
              <h3 style={panelTitleStyle}>Comparação por Item</h3>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={varianceChartData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="item" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value: number) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="orçado" fill={ACCENT_BLUE} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="realizado" fill={BRAND_GREEN} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={PANEL}>
              <h3 style={panelTitleStyle}>Tabela de Variação</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Item", "Descrição", "Orçado", "Realizado", "Δ Variação", "% Consumido"].map((column) => (
                        <th key={column} style={thStyle}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {varianceRows.map((row, index) => (
                      <tr key={`${row.item}-${index}`} style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={tdStyle}>{row.item}</td>
                        <td style={tdStyle}>{row.descricao}</td>
                        <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(row.orcado)}</td>
                        <td style={{ ...tdStyle, ...numberCellStyle }}>{formatCurrency(row.realizado)}</td>
                        <td
                          style={{
                            ...tdStyle,
                            ...numberCellStyle,
                            color: row.variancia <= 0 ? ACCENT_GREEN : ACCENT_RED,
                            fontWeight: 700,
                          }}
                        >
                          {formatCurrency(row.variancia)}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={progressTrackStyle}>
                              <div
                                style={{
                                  ...progressFillStyle,
                                  width: `${Math.min(row.consumido, 100)}%`,
                                  background: row.consumido > 100 ? ACCENT_RED : row.consumido >= 80 ? ACCENT_AMBER : ACCENT_GREEN,
                                }}
                              />
                            </div>
                            <span style={{ minWidth: 56, textAlign: "right", fontWeight: 700 }}>{fmtPct(row.consumido)}</span>
                          </div>
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
      </div>
    </SchemaGuard>
  )
}

function Pagination<T>({
  pageData,
  total,
  onChange,
}: {
  pageData: { page: number; totalPages: number; start: number; end: number; rows: T[] }
  total: number
  onChange: (page: number) => void
}) {
  if (pageData.totalPages <= 1) return null
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>
        Exibindo {pageData.start + 1}-{pageData.end} de {total}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.max(1, pageData.page - 1))}>
          Anterior
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={() => onChange(Math.min(pageData.totalPages, pageData.page + 1))}>
          Próxima
        </button>
      </div>
    </div>
  )
}

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
}

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
}

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 20,
  flexWrap: "wrap",
  alignItems: "flex-end",
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
}

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid rgba(11,79,58,0.14)",
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
}

const primaryButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "none",
  background: BRAND_GREEN,
  color: "#fff",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(11,79,58,0.14)",
  background: "#fff",
  color: "#0f172a",
  padding: "0 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
}

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  textAlign: "left",
  padding: "10px 12px",
  background: "#f8fafc",
  borderBottom: "2px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  zIndex: 1,
  cursor: "pointer",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  fontWeight: 500,
  color: "#0f172a",
}

const numberCellStyle: React.CSSProperties = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
}

const progressTrackStyle: React.CSSProperties = {
  width: 140,
  height: 10,
  background: "#e2e8f0",
  borderRadius: 999,
  overflow: "hidden",
}

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
}
