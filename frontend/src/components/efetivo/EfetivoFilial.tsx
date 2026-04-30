import React, { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { fetchApiJson } from "../../api/analytics"
import { formatInt, fmtPct } from "../../lib/formatters"

type FilialItem = {
  filial_obra: string
  cargo_funcao: string
  funcionarios: number
}

type FilialResponse = {
  items: FilialItem[]
  total_funcionarios: number
}

export function EfetivoFilial({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FilialItem[]>([])
  const [selectedFiliais, setSelectedFiliais] = useState<string[]>([])
  const [selectedCargos, setSelectedCargos] = useState<string[]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchApiJson<FilialResponse>(`/api/efetivo/${sessionId}/filial`)
      .then((response) => {
        if (!active) return
        setItems(response.items ?? [])
        setSelectedFiliais([])
        setSelectedCargos([])
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar dados por filial.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const filialOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.filial_obra).filter(Boolean))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [items],
  )
  const cargoOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.cargo_funcao).filter(Boolean))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [items],
  )

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesFilial = selectedFiliais.length === 0 || selectedFiliais.includes(item.filial_obra)
        const matchesCargo = selectedCargos.length === 0 || selectedCargos.includes(item.cargo_funcao)
        return matchesFilial && matchesCargo
      }),
    [items, selectedCargos, selectedFiliais],
  )

  const summaryRows = useMemo(() => {
    const grouped = filteredItems.reduce<Map<string, number>>((acc, item) => {
      acc.set(item.filial_obra, (acc.get(item.filial_obra) ?? 0) + item.funcionarios)
      return acc
    }, new Map<string, number>())
    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0)

    return Array.from(grouped.entries())
      .map(([filial, funcionarios]) => ({
        filial,
        funcionarios,
        percentual: total > 0 ? (funcionarios / total) * 100 : 0,
      }))
      .sort((left, right) => right.funcionarios - left.funcionarios)
  }, [filteredItems])

  const totalFuncionarios = useMemo(
    () => summaryRows.reduce((sum, row) => sum + row.funcionarios, 0),
    [summaryRows],
  )

  const clearFilters = () => {
    setSelectedFiliais([])
    setSelectedCargos([])
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={skeletonCardStyle} />
        <div style={{ ...skeletonCardStyle, height: 360 }} />
        <div style={{ ...skeletonCardStyle, height: 280 }} />
        <style>{skeletonAnimation}</style>
      </div>
    )
  }

  if (error) {
    return (
      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Erro ao carregar dados por filial</h3>
        <p style={emptyTextStyle}>{error}</p>
      </section>
    )
  }

  if (summaryRows.length === 0) {
    return (
      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Por Filial</h3>
        <p style={emptyTextStyle}>Nenhum registro de efetivo atende aos filtros selecionados.</p>
      </section>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={panelStyle}>
        <div style={headerRowStyle}>
          <div>
            <h3 style={panelTitleStyle}>Headcount por Filial/Obra</h3>
            <p style={panelSubtitleStyle}>Filtre por obra e cargo para comparar a distribuicao atual do efetivo.</p>
          </div>
          <button type="button" onClick={clearFilters} style={buttonStyle}>
            Limpar Filtros
          </button>
        </div>

        <div style={filtersGridStyle}>
          <label style={filterLabelStyle}>
            Filial/Obra
            <select
              multiple
              value={selectedFiliais}
              onChange={(event) => setSelectedFiliais(Array.from(event.target.selectedOptions, (option) => option.value))}
              style={multiSelectStyle}
            >
              {filialOptions.map((filial) => (
                <option key={filial} value={filial}>
                  {filial}
                </option>
              ))}
            </select>
          </label>
          <label style={filterLabelStyle}>
            Cargo/Função
            <select
              multiple
              value={selectedCargos}
              onChange={(event) => setSelectedCargos(Array.from(event.target.selectedOptions, (option) => option.value))}
              style={multiSelectStyle}
            >
              {cargoOptions.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </label>
          <div style={metricCardStyle}>
            <p style={metricLabelStyle}>Funcionarios no filtro</p>
            <p style={metricValueStyle}>{formatInt(totalFuncionarios)}</p>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Distribuicao por Obra</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={summaryRows} layout="vertical" margin={{ top: 12, right: 20, left: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis type="number" tick={{ fill: "#cbd5e1", fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="filial" width={220} tick={{ fill: "#e2e8f0", fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [formatInt(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)), "Funcionarios"]}
              contentStyle={{
                background: "#020617",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: 12,
                color: "#f8fafc",
              }}
              cursor={{ fill: "rgba(16,185,129,0.08)" }}
            />
            <Bar dataKey="funcionarios" fill="#10b981" radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Detalhamento</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>FILIAL/OBRA</th>
                <th style={{ ...thStyle, textAlign: "right" }}>FUNCIONÁRIOS</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% DO TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, index) => (
                <tr key={row.filial} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.34)" : "rgba(15,23,42,0.18)" }}>
                  <td style={tdStyle}>{row.filial}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{formatInt(row.funcionarios)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#6ee7b7" }}>{fmtPct(row.percentual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(2,6,23,0.94), rgba(15,23,42,0.9))",
  border: "1px solid rgba(16,185,129,0.18)",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 18px 48px rgba(2,6,23,0.26)",
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#f8fafc",
}

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#94a3b8",
}

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: 18,
}

const filtersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(220px, 260px)",
  gap: 16,
  alignItems: "stretch",
}

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 11,
  fontWeight: 800,
  color: "#cbd5e1",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const multiSelectStyle: React.CSSProperties = {
  minHeight: 120,
  borderRadius: 16,
  border: "1px solid rgba(16,185,129,0.2)",
  background: "rgba(15,23,42,0.72)",
  color: "#f8fafc",
  padding: "10px 12px",
  fontSize: 13,
}

const metricCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(16,185,129,0.18)",
  background: "rgba(16,185,129,0.08)",
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
}

const metricLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#a7f3d0",
}

const metricValueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 30,
  fontWeight: 800,
  color: "#f8fafc",
}

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  background: "#047857",
  color: "#ffffff",
  padding: "11px 16px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(148,163,184,0.1)",
  color: "#f8fafc",
  fontSize: 13,
}

const emptyTextStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: 14,
}

const skeletonCardStyle: React.CSSProperties = {
  height: 120,
  borderRadius: 20,
  background: "linear-gradient(90deg, rgba(15,23,42,0.92), rgba(30,41,59,0.9), rgba(15,23,42,0.92))",
  backgroundSize: "200% 100%",
  animation: "efetivo-filial-wave 1.4s ease infinite",
}

const skeletonAnimation = `
  @keyframes efetivo-filial-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`
