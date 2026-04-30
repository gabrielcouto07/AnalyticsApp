import React, { useEffect, useMemo, useState } from "react"

import { EmptyState } from "../layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "../layout/schemaRequirements"
import { useSessionStore } from "../../store/session"
import { buildWorkRows, fetchEfetivoBase } from "./data"
import type { DetailSortKey } from "./types"

function DetalhamentoSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={headerSkeletonStyle} />
      <div style={tableSkeletonStyle} />
      <style>{skeletonStyle}</style>
    </div>
  )
}

const PAGE_SIZE = 50

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function EfetivoDetalhamento({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReturnType<typeof buildWorkRows>>([])
  const [page, setPage] = useState(1)
  const [fornecedorFilter, setFornecedorFilter] = useState("")
  const [cargoFilter, setCargoFilter] = useState("")
  const [sort, setSort] = useState<{ key: DetailSortKey; direction: "asc" | "desc" }>({
    key: "quantidade",
    direction: "desc",
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchEfetivoBase(sessionId)
      .then((base) => {
        if (!active) return
        setRows(buildWorkRows(base.summary, base.months))
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar o detalhamento do efetivo.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const fornecedorOk =
        !fornecedorFilter || normalizeText(row.fornecedor).includes(normalizeText(fornecedorFilter))
      const cargoOk = !cargoFilter || normalizeText(row.cargo).includes(normalizeText(cargoFilter))
      return fornecedorOk && cargoOk
    })
  }, [cargoFilter, fornecedorFilter, rows])

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => {
      const leftValue = left[sort.key]
      const rightValue = right[sort.key]
      const direction = sort.direction === "asc" ? 1 : -1

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction
      }

      return String(leftValue).localeCompare(String(rightValue), "pt-BR") * direction
    })
  }, [filteredRows, sort])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, sortedRows.length)
  const pagedRows = sortedRows.slice(start, end)

  if (loading) return <DetalhamentoSkeleton />

  if (error || rows.length === 0) {
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
          Fornecedor
          <input
            type="text"
            value={fornecedorFilter}
            onChange={(event) => {
              setFornecedorFilter(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar fornecedor"
            style={filterInputStyle}
          />
        </label>
        <label style={filterLabelStyle}>
          Cargo / Funcao
          <input
            type="text"
            value={cargoFilter}
            onChange={(event) => {
              setCargoFilter(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar cargo / funcao"
            style={filterInputStyle}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setFornecedorFilter("")
            setCargoFilter("")
            setPage(1)
          }}
          style={resetButtonStyle}
        >
          Limpar Filtros
        </button>
      </div>

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h3 style={panelTitleStyle}>Detalhamento dos Registros</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
              {filteredRows.length.toLocaleString("pt-BR")} registros filtrados
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
              disabled={currentPage === 1}
              style={{ ...pagerButtonStyle, opacity: currentPage === 1 ? 0.5 : 1 }}
            >
              Pagina anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ ...pagerButtonStyle, opacity: currentPage === totalPages ? 0.5 : 1 }}
            >
              Proxima pagina
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  ["filial", "Filial/Obra"],
                  ["fornecedor", "Fornecedor"],
                  ["cargo", "Cargo/Funcao"],
                  ["periodo", "Periodo"],
                  ["dia", "Dia"],
                  ["quantidade", "Qtd"],
                ].map(([key, label]) => (
                  <th key={key} style={thStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) => ({
                          key: key as DetailSortKey,
                          direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
                        }))
                      }
                      style={sortButtonStyle}
                    >
                      {label}
                      {sort.key === key ? (sort.direction === "asc" ? " ^" : " v") : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => (
                <tr
                  key={`${row.filial}-${row.fornecedor}-${row.cargo}-${row.periodo}-${row.dia}-${index}`}
                  style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.02)" : "transparent" }}
                >
                  <td style={tdStyle}>{row.filial}</td>
                  <td style={tdStyle}>{row.fornecedor}</td>
                  <td style={tdStyle}>{row.cargo}</td>
                  <td style={tdStyle}>{row.periodo}</td>
                  <td style={tdStyle}>{row.dia}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>
                    {row.quantidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            Exibindo {sortedRows.length === 0 ? 0 : `${start + 1}-${end}`} de {filteredRows.length} registros
          </span>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            Pagina {currentPage} de {totalPages}
          </span>
        </div>
      </div>
    </div>
  )
}

const skeletonStyle = `
  @keyframes efetivo-detalhe-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const headerSkeletonStyle: React.CSSProperties = {
  height: 72,
  borderRadius: 16,
  background: "linear-gradient(90deg, rgba(226,232,240,0.8), rgba(241,245,249,0.95), rgba(226,232,240,0.8))",
  backgroundSize: "200% 100%",
  animation: "efetivo-detalhe-wave 1.4s ease infinite",
}

const tableSkeletonStyle: React.CSSProperties = {
  ...headerSkeletonStyle,
  height: 360,
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
  minWidth: 240,
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
}

const filterInputStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.18)",
  borderRadius: 8,
  color: "#0f172a",
  padding: "10px 12px",
  fontSize: 12,
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

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(11,79,58,0.12)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(11,79,58,0.08)",
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
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

const sortButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "inherit",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
}
