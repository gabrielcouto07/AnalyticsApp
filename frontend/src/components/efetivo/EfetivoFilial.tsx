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
    () =>
      Array.from(new Set(items.map((item) => item.filial_obra).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      ),
    [items],
  )
  const cargoOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.cargo_funcao).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      ),
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
      .map(([obra, funcionarios]) => ({
        obra,
        funcionarios,
        percentual: total > 0 ? (funcionarios / total) * 100 : 0,
      }))
      .sort((left, right) => right.funcionarios - left.funcionarios)
  }, [filteredItems])

  const totalFuncionarios = useMemo(() => summaryRows.reduce((sum, row) => sum + row.funcionarios, 0), [summaryRows])

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
        <h3 style={panelTitleStyle}>Erro ao carregar dados por obra</h3>
        <p style={emptyTextStyle}>{error}</p>
      </section>
    )
  }

  if (summaryRows.length === 0) {
    return (
      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Por Obra</h3>
        <p style={emptyTextStyle}>Nenhum registro de efetivo atende aos filtros selecionados.</p>
      </section>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={panelStyle}>
        <div style={headerRowStyle}>
          <div>
            <h3 style={panelTitleStyle}>Headcount por Obra</h3>
            <p style={panelSubtitleStyle}>Filtre por obra e cargo para comparar a distribuicao atual do efetivo.</p>
          </div>
          <button type="button" onClick={clearFilters} style={buttonStyle}>
            Limpar Filtros
          </button>
        </div>

        <div style={filtersGridStyle}>
          <label style={filterLabelStyle}>
            Obra
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
            <p style={metricLabelStyle}>Funcionários no filtro</p>
            <p style={metricValueStyle}>{formatInt(totalFuncionarios)}</p>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Distribuição por Obra</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={summaryRows} layout="vertical" margin={{ top: 12, right: 20, left: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe6de" />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="obra" width={220} tick={{ fill: "#0f172a", fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [formatInt(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)), "Funcionários"]}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(11,79,58,0.14)",
                borderRadius: 12,
                color: "#0f172a",
                boxShadow: "0 14px 34px rgba(15,23,42,0.12)",
              }}
              cursor={{ fill: "rgba(11,79,58,0.06)" }}
            />
            <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Detalhe por Obra</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>OBRA</th>
                <th style={{ ...thStyle, textAlign: "right" }}>FUNCIONÁRIOS</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% DO TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, index) => (
                <tr key={row.obra} style={{ background: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={tdStyle}>{row.obra}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{formatInt(row.funcionarios)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#047857" }}>{fmtPct(row.percentual)}</td>
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
  background: "#ffffff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
}

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#64748b",
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
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const multiSelectStyle: React.CSSProperties = {
  minHeight: 120,
  borderRadius: 16,
  border: "1px solid rgba(11,79,58,0.18)",
  background: "#ffffff",
  color: "#0f172a",
  padding: "10px 12px",
  fontSize: 13,
}

const metricCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(11,79,58,0.14)",
  background: "linear-gradient(180deg, rgba(240,253,244,0.96), rgba(236,253,245,0.86))",
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
  color: "#047857",
}

const metricValueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 30,
  fontWeight: 800,
  color: "#0b4f3a",
}

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  background: "#0b4f3a",
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
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 13,
}

const emptyTextStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#64748b",
  fontSize: 14,
}

const skeletonCardStyle: React.CSSProperties = {
  height: 120,
  borderRadius: 20,
  background: "linear-gradient(90deg, rgba(226,232,240,0.9), rgba(241,245,249,0.98), rgba(226,232,240,0.9))",
  backgroundSize: "200% 100%",
  animation: "efetivo-filial-wave 1.4s ease infinite",
}

const skeletonAnimation = `
  @keyframes efetivo-filial-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`
