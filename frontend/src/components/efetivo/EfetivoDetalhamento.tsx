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

const PAGE_SIZE = 25

export function EfetivoDetalhamento({ sessionId }: { sessionId: string }) {
  const uploadedSchemas = useSessionStore((state) => state.schemaTypes)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReturnType<typeof buildWorkRows>>([])
  const [page, setPage] = useState(1)
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

  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const leftValue = left[sort.key]
      const rightValue = right[sort.key]
      const direction = sort.direction === "asc" ? 1 : -1

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction
      }

      return String(leftValue).localeCompare(String(rightValue), "pt-BR") * direction
    })
  }, [rows, sort])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h3 style={panelTitleStyle}>Detalhamento dos Registros</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
            {rows.length.toLocaleString("pt-BR")} linhas disponíveis • página {currentPage} de {totalPages}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={currentPage === 1}
            style={{ ...pagerButtonStyle, opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Página anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{ ...pagerButtonStyle, opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Próxima página
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
                ["cargo", "Cargo/Função"],
                ["periodo", "Período"],
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
                    {sort.key === key ? (sort.direction === "asc" ? " ▲" : " ▼") : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, index) => (
              <tr key={`${row.filial}-${row.fornecedor}-${row.cargo}-${row.periodo}-${row.dia}-${index}`}>
                <td style={tdStyle}>{row.filial}</td>
                <td style={tdStyle}>{row.fornecedor}</td>
                <td style={tdStyle}>{row.cargo}</td>
                <td style={tdStyle}>{row.periodo}</td>
                <td style={tdStyle}>{row.dia}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
