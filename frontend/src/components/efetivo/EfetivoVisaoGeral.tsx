import type React from "react"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { type AnomalyPoint, type MonthData, type Summary, type TrendData } from "./types"
import { lightCardStyle, selectStyle, tdStyle, thStyle } from "./styles"

const COLORS = [
  "#4f8ef7", "#34c97e", "#f5a623", "#e05263",
  "#a78bfa", "#06b6d4", "#f97316", "#ec4899",
]

const MONTH_MAP: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>Dia {label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: "2px 0" }}>
          {entry.dataKey}: <strong>{entry.value}</strong>
        </p>
      ))}
      <p style={{ color: "#f1f5f9", marginTop: 6, borderTop: "1px solid #334155", paddingTop: 4 }}>
        Total: <strong>{total}</strong>
      </p>
    </div>
  )
}

interface Props {
  summary: Summary | null
  months: MonthData[]
  activeMes: number | null
  trendTotal: TrendData | null
  trendMedia: TrendData | null
  anomalyPoints: AnomalyPoint[]
  filterForn: string
  setFilterForn: React.Dispatch<React.SetStateAction<string>>
  filterFuncao: string
  setFilterFuncao: React.Dispatch<React.SetStateAction<string>>
  showAllDias: boolean
  setShowAllDias: React.Dispatch<React.SetStateAction<boolean>>
  hiddenFornecedores: string[]
  setHiddenFornecedores: React.Dispatch<React.SetStateAction<string[]>>
  onMonthSelect: (mes: number) => void
  trendArrow: (trend: TrendData | null) => string
}

export function EfetivoVisaoGeral({
  summary,
  months,
  activeMes,
  trendTotal,
  trendMedia,
  anomalyPoints,
  filterForn,
  setFilterForn,
  filterFuncao,
  setFilterFuncao,
  showAllDias,
  setShowAllDias,
  hiddenFornecedores,
  setHiddenFornecedores,
  onMonthSelect,
  trendArrow,
}: Props) {
  const currentMonth = months.find((month) => month.mes === activeMes) ?? months[0]

  if (!currentMonth) {
    return (
      <div style={lightCardStyle}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Nenhum mês disponível para exibir a visão geral.</p>
      </div>
    )
  }

  const fornecedores = currentMonth.fornecedores ?? []
  const funcaoDetail = currentMonth.funcao_detail ?? []
  const dailyPivot = currentMonth.daily_pivot ?? []
  const grandMedia = summary ? summary.media_diaria : 0
  const monthKey = (currentMonth.mes_nome || "").toLowerCase()
  const monthNumber = currentMonth.mes ?? MONTH_MAP[monthKey] ?? 0

  const funcaoPorDia: Record<number, NonNullable<MonthData["funcao_detail"]>> = {}
  for (const row of funcaoDetail) {
    if (filterForn !== "all" && row.fornecedor !== filterForn) continue
    if (filterFuncao !== "all" && row.funcao !== filterFuncao) continue
    if (!funcaoPorDia[row.dia]) funcaoPorDia[row.dia] = []
    funcaoPorDia[row.dia].push(row)
  }

  const dias = Object.keys(funcaoPorDia).map(Number).sort((a, b) => a - b)
  const diasVisiveis = showAllDias ? dias : dias.slice(0, 7)

  const anomalyDaySet = new Set<number>()
  for (const point of anomalyPoints) {
    const dt = new Date(point.data)
    if (!Number.isNaN(dt.getTime()) && dt.getMonth() + 1 === monthNumber) {
      anomalyDaySet.add(dt.getDate())
    }
  }

  const fornecedorTotals = fornecedores
    .map((fornecedor) => ({
      fornecedor,
      total: dailyPivot.reduce((sum, row) => sum + (Number(row[fornecedor]) || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Diárias", value: summary ? summary.total_diarias.toLocaleString("pt-BR") : "—", color: "#4f8ef7", icon: "📋", trend: trendArrow(trendTotal) },
          { label: "Dias Ativos", value: summary?.dias_ativos, color: "#34c97e", icon: "📅" },
          { label: "Média Diária", value: summary?.media_diaria, color: "#f5a623", icon: "📊", trend: trendArrow(trendMedia) },
          { label: "Fornecedores", value: summary?.unique_fornecedores, color: "#a78bfa", icon: "🏢" },
          { label: "Funções", value: summary?.unique_funcoes, color: "#06b6d4", icon: "👷" },
        ].map(({ label, value, color, icon, trend }) => (
          <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: `1px solid ${color}30`, borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 160 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {icon} {label} {trend ? ` ${trend}` : ""}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color }}>{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 24, gap: 16 }}>
        {months.map((month) => (
          <button
            key={month.mes}
            type="button"
            onClick={() => {
              onMonthSelect(month.mes)
              setFilterForn("all")
              setFilterFuncao("all")
              setShowAllDias(false)
              setHiddenFornecedores([])
            }}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeMes === month.mes ? "2px solid #0b4f3a" : "2px solid transparent",
              color: activeMes === month.mes ? "#0b4f3a" : "#64748b",
              fontWeight: activeMes === month.mes ? 700 : 600,
              padding: "0 2px 10px",
              cursor: "pointer",
            }}
          >
            {month.mes_nome}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "#fff", border: "1px solid rgba(11,79,58,0.12)", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
          Filial
          <select value={filterForn} onChange={(event) => setFilterForn(event.target.value)} style={{ ...selectStyle, minHeight: 72 }}>
            <option value="all">Todos fornecedores</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor} value={fornecedor}>
                {fornecedor}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220, color: "#0f172a", fontSize: 12, fontWeight: 700 }}>
          Cargo / Função
          <select value={filterFuncao} onChange={(event) => setFilterFuncao(event.target.value)} style={{ ...selectStyle, minHeight: 72 }}>
            <option value="all">Todas funções</option>
            {Array.from(new Set(funcaoDetail.map((row) => row.funcao))).map((funcao) => (
              <option key={funcao} value={funcao}>
                {funcao}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
          📈 Serviços Presentes por Dia — {currentMonth.mes_nome}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#94a3b8" }}>
          Trabalhadores por dia por fornecedor
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyPivot} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="Dia"
              interval={0}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{ value: "Dia", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }}
            />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 12, cursor: "pointer" }}
              onClick={(payload: any) => {
                const key = payload?.dataKey
                if (!key) return
                setHiddenFornecedores((previous) => (previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]))
              }}
            />
            <ReferenceLine
              y={grandMedia}
              stroke="#475569"
              strokeDasharray="5 5"
              label={{ value: `Média geral: ${grandMedia}`, fill: "#64748b", fontSize: 10, position: "right" }}
            />
            {[...anomalyDaySet].map((day) => {
              const dayRow = dailyPivot.find((row) => Number(row.Dia) === day)
              const total = fornecedores.reduce((sum, fornecedor) => sum + (Number(dayRow?.[fornecedor]) || 0), 0)
              return <ReferenceDot key={`anom-${day}`} x={day} y={total} r={6} fill="#ef4444" stroke="#7f1d1d" />
            })}
            {fornecedores.map((fornecedor, index) => (
              <Line
                key={fornecedor}
                type="monotone"
                dataKey={fornecedor}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3, fill: COLORS[index % COLORS.length] }}
                activeDot={{ r: 5 }}
                connectNulls
                hide={hiddenFornecedores.includes(fornecedor)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
          📶 Totais por Fornecedor — {currentMonth.mes_nome}
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(220, fornecedorTotals.length * 36)}>
          <BarChart data={fornecedorTotals} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis type="category" dataKey="fornecedor" width={180} tick={{ fill: "#f1f5f9", fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#4f8ef7" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              👷 Serviços por Dia — {currentMonth.mes_nome}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
              Quais funções estavam presentes em cada dia
            </p>
          </div>
        </div>

        {dias.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>Nenhum dado para os filtros selecionados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Dia</th>
                  <th style={thStyle}>Fornecedor</th>
                  <th style={thStyle}>Serviço / Função</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Qtd</th>
                </tr>
              </thead>
              <tbody>
                {diasVisiveis.map((dia) =>
                  funcaoPorDia[dia].map((row, index) => {
                    const colorIndex = fornecedores.indexOf(row.fornecedor)
                    const color = COLORS[colorIndex >= 0 ? colorIndex % COLORS.length : index % COLORS.length]
                    return (
                      <tr key={`${dia}-${row.fornecedor}-${row.funcao}`} style={{ background: dia % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                        {index === 0 && (
                          <td
                            rowSpan={funcaoPorDia[dia].length}
                            style={{ ...tdStyle, fontWeight: 800, color: "#94a3b8", verticalAlign: "middle", fontSize: 14, borderRight: "1px solid #334155" }}
                          >
                            {String(dia).padStart(2, "0")}
                          </td>
                        )}
                        <td style={{ ...tdStyle, color, fontWeight: 600 }}>{row.fornecedor}</td>
                        <td style={{ ...tdStyle, color: "#f1f5f9" }}>{row.funcao}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color }}>{row.quantidade}</td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #334155" }}>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: "#f1f5f9" }}>Total no mês</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#f5a623" }}>
                    {dias.reduce((sum, dia) => sum + funcaoPorDia[dia].reduce((inner, row) => inner + row.quantidade, 0), 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {dias.length > 7 && (
          <div style={{ position: "sticky", bottom: 0, marginTop: 10, paddingTop: 8, background: "linear-gradient(180deg, rgba(30,41,59,0), rgba(30,41,59,0.9) 35%)" }}>
            <button type="button" onClick={() => setShowAllDias((value) => !value)} style={{ ...selectStyle, width: "100%", fontWeight: 700 }}>
              {showAllDias ? "Recolher" : `Mostrar todos os ${dias.length} dias`}
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid #334155", borderRadius: 14, padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
          📋 Totais por Dia × Fornecedor — {currentMonth.mes_nome}
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Dia</th>
                {fornecedores.map((fornecedor, index) => (
                  <th key={fornecedor} style={{ ...thStyle, color: COLORS[index % COLORS.length] }}>{fornecedor}</th>
                ))}
                <th style={{ ...thStyle, color: "#f5a623" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {dailyPivot.map((row, index) => {
                const total = fornecedores.reduce((sum, fornecedor) => sum + (Number(row[fornecedor]) || 0), 0)
                return (
                  <tr key={row.Dia} style={{ background: index % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#94a3b8" }}>
                      {String(row.Dia).padStart(2, "0")}
                    </td>
                    {fornecedores.map((fornecedor, colorIndex) => {
                      const value = Number(row[fornecedor]) || 0
                      return (
                        <td key={fornecedor} style={{ ...tdStyle, color: value > 0 ? COLORS[colorIndex % COLORS.length] : "#334155", fontWeight: value > 0 ? 600 : 400 }}>
                          {value > 0 ? value : "—"}
                        </td>
                      )
                    })}
                    <td style={{ ...tdStyle, fontWeight: 700, color: total > 0 ? "#f5a623" : "#334155" }}>
                      {total > 0 ? total : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
