import React, { useEffect, useMemo, useState } from "react"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { useSessionStore } from "../../store/session"
import { buildBranchRows, buildCompleteness, buildWorkRows, fetchEfetivoBase } from "./data"

function FilialSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={filterSkeletonStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={cardSkeletonStyle} />
        ))}
      </div>
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

export function EfetivoFilial({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterFilial, setFilterFilial] = useState<string[]>([])
  const [filterCargo, setFilterCargo] = useState<string[]>([])
  const [workRows, setWorkRows] = useState<ReturnType<typeof buildWorkRows>>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchEfetivoBase(sessionId)
      .then((base) => {
        if (!active) return
        setWorkRows(buildWorkRows(base.summary, base.months))
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
    () => Array.from(new Set(workRows.map((row) => row.filial).filter(Boolean))).sort(),
    [workRows],
  )
  const cargoOptions = useMemo(
    () => Array.from(new Set(workRows.map((row) => row.cargo).filter(Boolean))).sort(),
    [workRows],
  )

  const filteredWorkRows = useMemo(
    () =>
      workRows.filter((row) => {
        const filialOk = filterFilial.length === 0 || filterFilial.includes(row.filial)
        const cargoOk = filterCargo.length === 0 || filterCargo.includes(row.cargo)
        return filialOk && cargoOk
      }),
    [filterCargo, filterFilial, workRows],
  )

  const branchRows = useMemo(() => buildBranchRows(filteredWorkRows), [filteredWorkRows])
  const totalFuncionarios = filteredWorkRows.reduce((sum, row) => sum + row.quantidade, 0)
  const completeness = buildCompleteness(filteredWorkRows)

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
            style={filterSelectStyle}
          >
            {filialOptions.map((filial) => (
              <option key={filial} value={filial}>
                {filial}
              </option>
            ))}
          </select>
        </label>
        <label style={filterLabelStyle}>
          Cargo / Função
          <select
            multiple
            value={filterCargo}
            onChange={(event) => setFilterCargo(selectMultiValues(event.currentTarget.options))}
            style={filterSelectStyle}
          >
            {cargoOptions.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setFilterFilial([])
            setFilterCargo([])
          }}
          style={resetButtonStyle}
        >
          Limpar Filtros
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Total Funcionários", value: totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Obras Ativas", value: String(new Set(filteredWorkRows.map((row) => row.filial)).size) },
          { label: "Cargos Distintos", value: String(new Set(filteredWorkRows.map((row) => row.cargo)).size) },
          { label: "% Dados Completos", value: `${completeness}%` },
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
        <h3 style={panelTitleStyle}>Headcount por Obra</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={branchRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis type="category" dataKey="filial" width={200} tick={{ fill: "#0f172a", fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Detalhe por Obra</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Obra</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Funcionários</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% do Total</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((row) => (
                <tr key={row.filial}>
                  <td style={tdStyle}>{row.filial}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                    {row.funcionarios.toLocaleString("pt-BR")}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{row.percentage.toLocaleString("pt-BR")}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
}

const filterSelectStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "8px 10px",
  fontSize: 12,
  minHeight: 84,
}

const resetButtonStyle: React.CSSProperties = {
  background: "#cbbba0",
  color: "#0b4f3a",
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
