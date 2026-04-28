import React, { useEffect, useState } from "react"

import { API_BASE_URL, templatesApiUrl } from "../api/client"
import {
  EfetivoDetalhamento,
  EfetivoEvolucao,
  EfetivoFilial,
  EfetivoVisaoGeral,
} from "./efetivo"
import {
  type AnomalyPoint,
  type BranchRow,
  type DetailSortKey,
  type EfetivoTab,
  type MonthData,
  type Summary,
  type TrendData,
  type WorkRow,
} from "./efetivo/types"

const TAB_LABELS: Array<{ id: EfetivoTab; label: string }> = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "por-filial", label: "Por Filial" },
  { id: "evolucao", label: "Evolução" },
  { id: "detalhamento", label: "Detalhamento" },
]

export const EfetivoDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [months, setMonths] = useState<MonthData[]>([])
  const [trendTotal, setTrendTotal] = useState<TrendData | null>(null)
  const [trendMedia, setTrendMedia] = useState<TrendData | null>(null)
  const [anomalyPoints, setAnomalyPoints] = useState<AnomalyPoint[]>([])
  const [activeMes, setActiveMes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [filterForn, setFilterForn] = useState<string>("all")
  const [filterFuncao, setFilterFuncao] = useState<string>("all")
  const [diaIndex, setDiaIndex] = useState(0)
  const [showAllDias, setShowAllDias] = useState(false)
  const [hiddenFornecedores, setHiddenFornecedores] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<EfetivoTab>("visao-geral")
  const [filterFilial, setFilterFilial] = useState<string[]>([])
  const [filterCargo, setFilterCargo] = useState<string[]>([])
  const [detailSort, setDetailSort] = useState<{ key: DetailSortKey; direction: "asc" | "desc" }>({
    key: "quantidade",
    direction: "desc",
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setWarnings([])
      try {
        const requests = await Promise.allSettled([
          fetch(templatesApiUrl(`/efetivo/analysis/${sessionId}`)).then((response) => response.json()),
          fetch(templatesApiUrl(`/efetivo/monthly-breakdown/${sessionId}`)).then((response) => response.json()),
          fetch(templatesApiUrl(`/efetivo/trend/${sessionId}?column=total_trabalhadores&window=7`)).then((response) => response.json()),
          fetch(templatesApiUrl(`/efetivo/trend/${sessionId}?column=fornecedores&window=7`)).then((response) => response.json()),
          fetch(templatesApiUrl(`/efetivo/anomalies/${sessionId}?method=iqr`)).then((response) => response.json()),
        ])

        const nextWarnings: string[] = []

        const analysisRes = requests[0].status === "fulfilled" ? requests[0].value : null
        if (analysisRes?.summary) {
          setSummary(analysisRes.summary)
        } else {
          nextWarnings.push("Resumo não pôde ser carregado.")
        }

        const monthlyRes = requests[1].status === "fulfilled" ? requests[1].value : []
        if (Array.isArray(monthlyRes) && monthlyRes.length > 0) {
          setMonths(monthlyRes)
          setActiveMes(monthlyRes[0].mes)
        } else {
          nextWarnings.push("Série mensal indisponível.")
        }

        if (requests[2].status === "fulfilled") {
          setTrendTotal(requests[2].value)
        } else {
          nextWarnings.push("Tendência de total diário indisponível.")
        }

        if (requests[3].status === "fulfilled") {
          setTrendMedia(requests[3].value)
        } else {
          nextWarnings.push("Tendência de fornecedores/dia indisponível.")
        }

        if (requests[4].status === "fulfilled") {
          setAnomalyPoints(Array.isArray(requests[4].value?.points) ? requests[4].value.points : [])
        } else {
          nextWarnings.push("Detecção de anomalias indisponível.")
        }

        setWarnings(nextWarnings)

        if (!analysisRes?.summary && (!Array.isArray(monthlyRes) || monthlyRes.length === 0)) {
          setError("Erro ao carregar dados essenciais do Efetivo.")
        }
      } catch {
        setError("Erro ao carregar dados do Efetivo.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sessionId])

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/export/${sessionId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "efetivo_export.xlsx"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      console.error("Erro ao exportar Efetivo", exportError)
    }
  }

  const trendArrow = (trend: TrendData | null): string => {
    if (!trend || trend.direction === "unknown") return "→"
    if (trend.direction === "up") return trend.strength === "forte" ? "↑" : "↗"
    if (trend.direction === "down") return trend.strength === "forte" ? "↓" : "↘"
    return "→"
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#4f8ef7", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#94a3b8" }}>Carregando Controle de Efetivo...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#fca5a5", background: "rgba(248,113,113,0.1)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)" }}>
        ⚠️ {error}
      </div>
    )
  }

  const workRows: WorkRow[] = months.flatMap((month) =>
    (month.funcao_detail ?? [])
      .filter((row) => Number(row.quantidade) > 0)
      .map((row) => ({
        filial: summary?.obra?.trim() || "Obra não identificada",
        fornecedor: row.fornecedor || "-",
        cargo: row.funcao || "-",
        periodo: month.mes_nome || String(month.mes),
        mes: month.mes,
        dia: row.dia,
        quantidade: Number(row.quantidade) || 0,
      })),
  )

  const filialOptions = Array.from(new Set(workRows.map((row) => row.filial).filter(Boolean))).sort()
  const cargoOptions = Array.from(new Set(workRows.map((row) => row.cargo).filter(Boolean))).sort()
  const filteredWorkRows = workRows.filter((row) => {
    const filialOk = filterFilial.length === 0 || filterFilial.includes(row.filial)
    const cargoOk = filterCargo.length === 0 || filterCargo.includes(row.cargo)
    return filialOk && cargoOk
  })

  const totalFuncionarios = filteredWorkRows.reduce((sum, row) => sum + row.quantidade, 0)
  const totalForCompleteness = Math.max(filteredWorkRows.length, 1)
  const completenessFields: Array<keyof WorkRow> = ["filial", "fornecedor", "cargo", "periodo", "dia", "quantidade"]
  const completeCells = filteredWorkRows.reduce(
    (sum, row) => sum + completenessFields.filter((field) => row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== "").length,
    0,
  )
  const completeness = filteredWorkRows.length
    ? Math.round((completeCells / (totalForCompleteness * completenessFields.length)) * 100)
    : 0

  const branchRows: BranchRow[] = Array.from(
    filteredWorkRows.reduce((acc, row) => {
      acc.set(row.filial, (acc.get(row.filial) ?? 0) + row.quantidade)
      return acc
    }, new Map<string, number>()),
  )
    .map(([filial, funcionarios]) => ({
      filial,
      funcionarios,
      percentage: totalFuncionarios ? Number(((funcionarios / totalFuncionarios) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.funcionarios - left.funcionarios)

  const evolutionData = Array.from(
    filteredWorkRows.reduce((acc, row) => {
      const existing = acc.get(row.mes) ?? { periodo: row.periodo, mes: row.mes, funcionarios: 0 }
      existing.funcionarios += row.quantidade
      acc.set(row.mes, existing)
      return acc
    }, new Map<number, { periodo: string; mes: number; funcionarios: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => left.mes - right.mes)

  const sortedDetailRows = [...filteredWorkRows].sort((left, right) => {
    const leftValue = left[detailSort.key]
    const rightValue = right[detailSort.key]
    const direction = detailSort.direction === "asc" ? 1 : -1
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction
    }
    return String(leftValue).localeCompare(String(rightValue), "pt-BR") * direction
  })

  const onMonthSelect = (mes: number) => {
    setActiveMes(mes)
    setFilterForn("all")
    setFilterFuncao("all")
    setDiaIndex(0)
    setShowAllDias(false)
    setHiddenFornecedores([])
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
            🏗️ Controle de Efetivo — {summary?.obra}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            {summary?.ano} · {summary?.meses_cobertos} {summary?.meses_cobertos === 1 ? "mês" : "meses"} · {summary?.unique_fornecedores} fornecedores · {summary?.unique_funcoes} funções
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          style={{
            background: "#0b4f3a",
            color: "#fff",
            border: "1px solid rgba(203,187,160,0.35)",
            borderRadius: 8,
            padding: "8px 16px",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ⬇ Exportar
        </button>
      </div>

      {warnings.length > 0 && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fcd34d", fontSize: 12 }}>
          ⚠️ Algumas análises não foram carregadas: {warnings.join(" ")}
        </div>
      )}

      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 24, gap: 16 }}>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === tab.id ? "2px solid #0b4f3a" : "2px solid transparent",
              color: activeTab === tab.id ? "#0b4f3a" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 600,
              padding: "0 2px 10px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "visao-geral" && (
        <EfetivoVisaoGeral
          summary={summary}
          months={months}
          activeMes={activeMes}
          trendTotal={trendTotal}
          trendMedia={trendMedia}
          anomalyPoints={anomalyPoints}
          filterForn={filterForn}
          setFilterForn={setFilterForn}
          filterFuncao={filterFuncao}
          setFilterFuncao={setFilterFuncao}
          diaIndex={diaIndex}
          setDiaIndex={setDiaIndex}
          showAllDias={showAllDias}
          setShowAllDias={setShowAllDias}
          hiddenFornecedores={hiddenFornecedores}
          setHiddenFornecedores={setHiddenFornecedores}
          onMonthSelect={onMonthSelect}
          trendArrow={trendArrow}
        />
      )}

      {activeTab === "por-filial" && (
        <EfetivoFilial
          branchRows={branchRows}
          filterFilial={filterFilial}
          setFilterFilial={setFilterFilial}
          filterCargo={filterCargo}
          setFilterCargo={setFilterCargo}
          filialOptions={filialOptions}
          cargoOptions={cargoOptions}
          filteredWorkRows={filteredWorkRows}
          totalFuncionarios={totalFuncionarios}
          completeness={completeness}
        />
      )}

      {activeTab === "evolucao" && <EfetivoEvolucao evolutionData={evolutionData} />}

      {activeTab === "detalhamento" && (
        <EfetivoDetalhamento
          sortedDetailRows={sortedDetailRows}
          detailSort={detailSort}
          setSort={(key) => setDetailSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }))}
        />
      )}
    </div>
  )
}
