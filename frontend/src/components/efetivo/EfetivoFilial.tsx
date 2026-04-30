import React, { useEffect, useMemo, useState } from "react"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useSessionStore } from "../../store/session"
import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { buildWorkRows, fetchEfetivoBase } from "./data"

const SERIES_COLORS = [
  "#4f8ef7",
  "#34c97e",
  "#f5a623",
  "#e05263",
  "#a78bfa",
  "#06b6d4",
  "#f97316",
  "#ec4899",
]

const OTHERS_KEY = "Outros"

function FilialSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={filterSkeletonStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
      <div style={{ ...panelSkeletonStyle, height: 420 }} />
      <div style={panelSkeletonStyle} />
      <div style={panelSkeletonStyle} />
      <style>{skeletonStyle}</style>
    </div>
  )
}

const selectMultiValues = (options: HTMLOptionsCollection): string[] =>
  Array.from(options)
    .filter((option) => option.selected)
    .map((option) => option.value)

function trendSymbol(firstHalf: number, secondHalf: number) {
  if (secondHalf > firstHalf) return "↑"
  if (secondHalf < firstHalf) return "↓"
  return "→"
}

export function EfetivoFilial({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterFilial, setFilterFilial] = useState<string[]>([])
  const [filterCargo, setFilterCargo] = useState<string[]>([])
  const [selectedMes, setSelectedMes] = useState<string>("all")
  const [hiddenCargos, setHiddenCargos] = useState<string[]>([])
  const [workRows, setWorkRows] = useState<ReturnType<typeof buildWorkRows>>([])
  const [months, setMonths] = useState<Awaited<ReturnType<typeof fetchEfetivoBase>>["months"]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchEfetivoBase(sessionId)
      .then((base) => {
        if (!active) return
        setMonths(base.months)
        setWorkRows(buildWorkRows(base.summary, base.months))
        setSelectedMes("all")
        setFilterFilial([])
        setFilterCargo([])
        setHiddenCargos([])
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar dados por obra.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const filialOptions = useMemo(
    () => Array.from(new Set(workRows.map((row) => row.filial).filter(Boolean))).sort(),
    [workRows],
  )
  const cargoOptions = useMemo(
    () => Array.from(new Set(workRows.map((row) => row.cargo).filter(Boolean))).sort(),
    [workRows],
  )
  const monthOptions = useMemo(
    () =>
      months.map((month) => ({
        value: String(month.mes),
        label: month.mes_nome,
      })),
    [months],
  )
  const baseFilteredRows = useMemo(
    () =>
      workRows.filter((row) => {
        const filialOk = filterFilial.length === 0 || filterFilial.includes(row.filial)
        const cargoOk = filterCargo.length === 0 || filterCargo.includes(row.cargo)
        return filialOk && cargoOk
      }),
    [filterCargo, filterFilial, workRows],
  )
  const selectedMonthRows = useMemo(() => {
    if (selectedMes === "all") return baseFilteredRows
    const monthNumber = Number(selectedMes)
    return baseFilteredRows.filter((row) => row.mes === monthNumber)
  }, [baseFilteredRows, selectedMes])
  const obrasNoFiltro = useMemo(() => new Set(selectedMonthRows.map((row) => row.filial)).size, [selectedMonthRows])
  const cargosNoFiltro = useMemo(() => new Set(selectedMonthRows.map((row) => row.cargo)).size, [selectedMonthRows])
  const totalDiariasFiltro = useMemo(
    () => selectedMonthRows.reduce((sum, row) => sum + row.quantidade, 0),
    [selectedMonthRows],
  )
  const topCargoKeys = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of selectedMonthRows) {
      grouped.set(row.cargo, (grouped.get(row.cargo) ?? 0) + row.quantidade)
    }
    return Array.from(grouped.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([cargo]) => cargo)
  }, [selectedMonthRows])
  const visibleCargoKeys = useMemo(
    () => topCargoKeys.concat(topCargoKeys.length < cargoOptions.length ? [OTHERS_KEY] : []),
    [cargoOptions.length, topCargoKeys],
  )
  const stackedChartData = useMemo(() => {
    const grouped = new Map<string, Record<string, number | string>>()

    for (const row of selectedMonthRows) {
      const obra = row.filial || "Obra nao identificada"
      const cargoKey = topCargoKeys.includes(row.cargo) ? row.cargo : OTHERS_KEY
      const current = grouped.get(obra) ?? { obra }
      current[cargoKey] = Number(current[cargoKey] ?? 0) + row.quantidade
      grouped.set(obra, current)
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const leftTotal = visibleCargoKeys.reduce(
        (sum, key) => sum + (typeof left[key] === "number" ? Number(left[key]) : 0),
        0,
      )
      const rightTotal = visibleCargoKeys.reduce(
        (sum, key) => sum + (typeof right[key] === "number" ? Number(right[key]) : 0),
        0,
      )
      return rightTotal - leftTotal
    })
  }, [selectedMonthRows, topCargoKeys, visibleCargoKeys])
  const visibleStackKeys = useMemo(
    () => visibleCargoKeys.filter((cargo) => !hiddenCargos.includes(cargo)),
    [hiddenCargos, visibleCargoKeys],
  )
  const evolutionChart = useMemo(() => {
    const obras = Array.from(new Set(baseFilteredRows.map((row) => row.filial))).sort()
    return monthOptions.map((month) => {
      const monthNumber = Number(month.value)
      const entry: Record<string, string | number> = { periodo: month.label }
      for (const obra of obras) {
        entry[obra] = baseFilteredRows
          .filter((row) => row.mes === monthNumber && row.filial === obra)
          .reduce((sum, row) => sum + row.quantidade, 0)
      }
      return entry
    })
  }, [baseFilteredRows, monthOptions])
  const evolutionObras = useMemo(
    () => Array.from(new Set(baseFilteredRows.map((row) => row.filial))).sort(),
    [baseFilteredRows],
  )
  const detailRows = useMemo(() => {
    const analysisRows = selectedMes === "all" ? baseFilteredRows : selectedMonthRows
    const monthOrder = monthOptions.map((month) => Number(month.value))
    const midpoint = Math.ceil(monthOrder.length / 2)
    const firstHalf = new Set(monthOrder.slice(0, midpoint))
    const secondHalf = new Set(monthOrder.slice(midpoint))
    const grouped = new Map<
      string,
      {
        obra: string
        total: number
        cargoMap: Map<string, number>
        fornecedores: Set<string>
        funcoes: Set<string>
        trendBase: Map<number, number>
      }
    >()

    for (const row of analysisRows) {
      const current = grouped.get(row.filial) ?? {
        obra: row.filial,
        total: 0,
        cargoMap: new Map<string, number>(),
        fornecedores: new Set<string>(),
        funcoes: new Set<string>(),
        trendBase: new Map<number, number>(),
      }
      current.total += row.quantidade
      current.cargoMap.set(row.cargo, (current.cargoMap.get(row.cargo) ?? 0) + row.quantidade)
      current.fornecedores.add(row.fornecedor)
      current.funcoes.add(row.cargo)
      grouped.set(row.filial, current)
    }

    for (const row of baseFilteredRows) {
      const current = grouped.get(row.filial)
      if (!current) continue
      current.trendBase.set(row.mes, (current.trendBase.get(row.mes) ?? 0) + row.quantidade)
    }

    return Array.from(grouped.values())
      .map((row) => {
        const cargoPrincipal =
          Array.from(row.cargoMap.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "-"
        const firstHalfTotal = Array.from(row.trendBase.entries())
          .filter(([mes]) => firstHalf.has(mes))
          .reduce((sum, [, total]) => sum + total, 0)
        const secondHalfTotal = Array.from(row.trendBase.entries())
          .filter(([mes]) => secondHalf.has(mes))
          .reduce((sum, [, total]) => sum + total, 0)

        return {
          obra: row.obra,
          cargoPrincipal,
          total: row.total,
          fornecedores: row.fornecedores.size,
          funcoes: row.funcoes.size,
          tendencia: trendSymbol(firstHalfTotal, secondHalfTotal),
        }
      })
      .sort((left, right) => right.total - left.total)
  }, [baseFilteredRows, monthOptions, selectedMes, selectedMonthRows])
  const selectedMonthLabel = useMemo(() => {
    if (selectedMes === "all") return "Todos os Periodos"
    return monthOptions.find((option) => option.value === selectedMes)?.label ?? "Periodo selecionado"
  }, [monthOptions, selectedMes])
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterFilial.length > 0) count += 1
    if (filterCargo.length > 0) count += 1
    if (selectedMes !== "all") count += 1
    return count
  }, [filterCargo.length, filterFilial.length, selectedMes])

  const clearFilters = () => {
    setFilterFilial([])
    setFilterCargo([])
    setSelectedMes("all")
    setHiddenCargos([])
  }

  if (loading) return <FilialSkeleton />

  if (error || workRows.length === 0) {
    return (
      <EmptyState
        schemaRequired="efetivo"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.efetivo}
        uploadedSchemas={uploadedSchemas}
      />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={filterPanelStyle}>
        <label style={filterLabelStyle}>
          Obra
          <select
            multiple
            value={filterFilial}
            onChange={(event) => setFilterFilial(selectMultiValues(event.currentTarget.options))}
            style={filterMultiSelectStyle}
            onFocus={(event) => {
              event.currentTarget.style.outline = "2px solid #0b4f3a"
              event.currentTarget.style.outlineOffset = "2px"
            }}
            onBlur={(event) => {
              event.currentTarget.style.outline = "none"
            }}
          >
            {filialOptions.map((filial) => (
              <option key={filial} value={filial}>
                {filial}
              </option>
            ))}
          </select>
        </label>

        <label style={filterLabelStyle}>
          Cargo / Funcao
          <select
            multiple
            value={filterCargo}
            onChange={(event) => setFilterCargo(selectMultiValues(event.currentTarget.options))}
            style={filterCargoSelectStyle}
            onFocus={(event) => {
              event.currentTarget.style.outline = "2px solid #0b4f3a"
              event.currentTarget.style.outlineOffset = "2px"
            }}
            onBlur={(event) => {
              event.currentTarget.style.outline = "none"
            }}
          >
            {cargoOptions.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>

        <label style={filterLabelStyle}>
          Mes / Periodo
          <select
            value={selectedMes}
            onChange={(event) => setSelectedMes(event.currentTarget.value)}
            style={filterSelectStyle}
            onFocus={(event) => {
              event.currentTarget.style.outline = "2px solid #0b4f3a"
              event.currentTarget.style.outlineOffset = "2px"
            }}
            onBlur={(event) => {
              event.currentTarget.style.outline = "none"
            }}
          >
            <option value="all">Todos os Periodos</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={clearFilters}
          style={resetButtonStyle}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "#08382a"
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "#0b4f3a"
          }}
        >
          Limpar Filtros
        </button>

        {activeFilterCount > 0 && (
          <button type="button" onClick={clearFilters} style={activeFilterBadgeStyle}>
            {activeFilterCount} filtros ativos
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Obras no Filtro", value: obrasNoFiltro.toLocaleString("pt-BR") },
          { label: "Cargos no Filtro", value: cargosNoFiltro.toLocaleString("pt-BR") },
          { label: "Total Diarias Filtro", value: totalDiariasFiltro.toLocaleString("pt-BR") },
        ].map((card) => (
          <div key={card.label} style={metricCardStyle}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
              {card.label}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: "#0b4f3a" }}>{card.value}</p>
          </div>
        ))}
      </div>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Composicao por Cargo - {selectedMonthLabel}</h3>
        {stackedChartData.length > 0 && visibleStackKeys.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={stackedChartData} margin={{ top: 12, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="obra" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                {visibleStackKeys.map((cargo, index) => (
                  <Bar
                    key={cargo}
                    dataKey={cargo}
                    stackId="obra"
                    fill={cargo === OTHERS_KEY ? "#94a3b8" : SERIES_COLORS[index % SERIES_COLORS.length]}
                    radius={index === visibleStackKeys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {visibleCargoKeys.map((cargo, index) => {
                const hidden = hiddenCargos.includes(cargo)
                return (
                  <button
                    key={cargo}
                    type="button"
                    onClick={() =>
                      setHiddenCargos((current) =>
                        hidden ? current.filter((item) => item !== cargo) : [...current, cargo],
                      )
                    }
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.22)",
                      padding: "6px 10px",
                      background: hidden ? "rgba(148,163,184,0.08)" : "rgba(255,255,255,0.96)",
                      color: hidden ? "#94a3b8" : "#0f172a",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: cargo === OTHERS_KEY ? "#94a3b8" : SERIES_COLORS[index % SERIES_COLORS.length],
                        marginRight: 6,
                      }}
                    />
                    {cargo}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div style={emptyPanelStateStyle}>Sem dados suficientes para montar a composicao por cargo.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Evolucao Mensal por Obra</h3>
        {evolutionChart.length > 0 && evolutionObras.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolutionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              {evolutionObras.map((obra, index) => (
                <Line
                  key={obra}
                  type="monotone"
                  dataKey={obra}
                  stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={emptyPanelStateStyle}>Sem dados suficientes para comparar a evolucao mensal das obras.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Detalhe por Obra</h3>
        {detailRows.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Obra</th>
                  <th style={thStyle}>Cargo Principal</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total Diarias</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Fornecedores</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Funcoes</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row) => (
                  <tr key={row.obra}>
                    <td style={tdStyle}>{row.obra}</td>
                    <td style={tdStyle}>{row.cargoPrincipal}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                      {row.total.toLocaleString("pt-BR")}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{row.fornecedores.toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{row.funcoes.toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: 18 }}>{row.tendencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={emptyPanelStateStyle}>Nenhuma obra corresponde aos filtros selecionados.</div>
        )}
      </section>
    </div>
  )
}

const skeletonStyle = `
  @keyframes efetivo-filial-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const cardSkeletonStyle: React.CSSProperties = {
  height: 110,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "efetivo-filial-wave 1.4s ease infinite",
}

const panelSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 280,
}

const filterSkeletonStyle: React.CSSProperties = {
  ...cardSkeletonStyle,
  height: 102,
}

const filterPanelStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-end",
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 14,
  padding: "18px 20px",
  boxShadow: "0 2px 8px rgba(11,79,58,0.06)",
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
}

const filterMultiSelectStyle: React.CSSProperties = {
  width: 200,
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 10px",
  fontSize: 13,
  minHeight: 90,
}

const filterCargoSelectStyle: React.CSSProperties = {
  ...filterMultiSelectStyle,
  width: 220,
}

const filterSelectStyle: React.CSSProperties = {
  width: 180,
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "0 10px",
  fontSize: 13,
  height: 38,
  cursor: "pointer",
}

const resetButtonStyle: React.CSSProperties = {
  background: "#0b4f3a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  height: 38,
  alignSelf: "flex-end",
}

const activeFilterBadgeStyle: React.CSSProperties = {
  background: "rgba(11,79,58,0.1)",
  color: "#0b4f3a",
  border: "none",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  height: 26,
  alignSelf: "flex-end",
}

const metricCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: "14px 18px",
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

const emptyPanelStateStyle: React.CSSProperties = {
  minHeight: 220,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  border: "1px dashed rgba(148,163,184,0.35)",
  borderRadius: 12,
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
}
