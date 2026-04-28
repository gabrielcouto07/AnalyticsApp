import type React from "react"

import { type DetailSortKey, type WorkRow } from "./types"
import { emptyStateStyle, lightCardStyle, lightTdStyle, lightThStyle, lightTitleStyle, sortButtonStyle } from "./styles"

interface Props {
  sortedDetailRows: WorkRow[]
  detailSort: { key: DetailSortKey; direction: "asc" | "desc" }
  setSort: (key: DetailSortKey) => void
}

export function EfetivoDetalhamento({ sortedDetailRows, detailSort, setSort }: Props) {
  return (
    <div style={lightCardStyle}>
      <h3 style={lightTitleStyle}>Detalhamento dos Registros do ERP</h3>
      {sortedDetailRows.length === 0 ? (
        <p style={emptyStateStyle}>Nenhum registro encontrado para detalhamento.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", maxHeight: 520 }}>
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
                    <th key={key} style={lightThStyle}>
                      <button type="button" onClick={() => setSort(key as DetailSortKey)} style={sortButtonStyle}>
                        {label}
                        {detailSort.key === key ? (detailSort.direction === "asc" ? " ▲" : " ▼") : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDetailRows.slice(0, 500).map((row, index) => (
                  <tr key={`${row.filial}-${row.fornecedor}-${row.cargo}-${row.periodo}-${row.dia}-${index}`}>
                    <td style={lightTdStyle}>{row.filial}</td>
                    <td style={lightTdStyle}>{row.fornecedor}</td>
                    <td style={lightTdStyle}>{row.cargo}</td>
                    <td style={lightTdStyle}>{row.periodo}</td>
                    <td style={lightTdStyle}>{row.dia}</td>
                    <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedDetailRows.length > 500 && (
            <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 12 }}>
              Exibindo os primeiros 500 registros de {sortedDetailRows.length.toLocaleString("pt-BR")}.
            </p>
          )}
        </>
      )}
    </div>
  )
}
