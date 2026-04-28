import type React from "react"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { type BranchRow, type WorkRow } from "./types"
import { emptyStateStyle, filterSelectStyle, lightCardStyle, lightTdStyle, lightThStyle, lightTitleStyle } from "./styles"

interface Props {
  branchRows: BranchRow[]
  filterFilial: string[]
  setFilterFilial: React.Dispatch<React.SetStateAction<string[]>>
  filterCargo: string[]
  setFilterCargo: React.Dispatch<React.SetStateAction<string[]>>
  filialOptions: string[]
  cargoOptions: string[]
  filteredWorkRows: WorkRow[]
  totalFuncionarios: number
  completeness: number
}

const selectMultiValues = (options: HTMLOptionsCollection): string[] =>
  Array.from(options).filter((option) => option.selected).map((option) => option.value)

export function EfetivoFilial({
  branchRows,
  filterFilial,
  setFilterFilial,
  filterCargo,
  setFilterCargo,
  filialOptions,
  cargoOptions,
  filteredWorkRows,
  totalFuncionarios,
  completeness,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "#fff", border: "1px solid rgba(11,79,58,0.12)", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
          Fornecedor
          <select multiple value={filterFilial} onChange={(event) => setFilterFilial(selectMultiValues(event.currentTarget.options))} style={{ ...filterSelectStyle, minHeight: 72 }}>
            {filialOptions.map((filial) => <option key={filial} value={filial}>{filial}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
          Cargo / Função
          <select multiple value={filterCargo} onChange={(event) => setFilterCargo(selectMultiValues(event.currentTarget.options))} style={{ ...filterSelectStyle, minHeight: 72 }}>
            {cargoOptions.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setFilterFilial([])
            setFilterCargo([])
          }}
          style={{ background: "#cbbba0", color: "#0b4f3a", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}
        >
          Limpar Filtros
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Funcionários", value: totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Filiais/Obras Ativas", value: String(new Set(filteredWorkRows.map((row) => row.filial)).size) },
          { label: "Cargos Distintos", value: String(new Set(filteredWorkRows.map((row) => row.cargo)).size) },
          { label: "% Dados Completos", value: `${completeness}%` },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid rgba(11,79,58,0.12)", borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 140 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800 }}>{card.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#0b4f3a" }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={lightCardStyle}>
        <h3 style={lightTitleStyle}>Headcount por Filial / Obra</h3>
        {branchRows.length === 0 ? (
          <p style={emptyStateStyle}>Não foi encontrada uma coluna de Filial ou Obra para agrupamento.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branchRows} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis type="category" dataKey="filial" width={180} tick={{ fill: "#0f172a", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: "8px" }} />
              <Bar dataKey="funcionarios" fill="#0b4f3a" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={lightCardStyle}>
        <h3 style={lightTitleStyle}>Detalhe por Filial / Obra</h3>
        {branchRows.length === 0 ? (
          <p style={emptyStateStyle}>Nenhum agrupamento disponível para os filtros selecionados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ cursor: "default" }}>
                  <th style={lightThStyle}>Filial/Obra</th>
                  <th style={{ ...lightThStyle, textAlign: "right" }}>Funcionários</th>
                  <th style={{ ...lightThStyle, textAlign: "right" }}>% do Total</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((row) => (
                  <tr key={row.filial} style={{ cursor: "default" }}>
                    <td style={lightTdStyle}>{row.filial}</td>
                    <td style={{ ...lightTdStyle, textAlign: "right", fontWeight: 800, color: "#0b4f3a" }}>{row.funcionarios.toLocaleString("pt-BR")}</td>
                    <td style={{ ...lightTdStyle, textAlign: "right" }}>{row.percentage.toLocaleString("pt-BR")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
