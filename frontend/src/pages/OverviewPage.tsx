import { useEffect, useState } from "react"
import { useSession } from "../store/session"
import { KpiCard } from "../components"
import { PeriodFilter } from "../components/PeriodFilter"
import { HBarChart } from "../components/charts/HBarChart"
import { MonthlyChart, type MonthPoint } from "../components/charts/MonthlyChart"
import { ChartCard, LoadingSkeleton } from "../components/common"
import { SourceBanner } from "../components/SourceBanner"
import { getDashboard } from "../api/analytics"
import { fmt } from "../lib/format"

interface DashboardData {
  filtros: { ano: number; mes: number | null; anos_disponiveis: number[]; excluir_intercompany: boolean }
  kpis: {
    saida: number
    entrada: number
    liquido: number
    venda: number
    documentos: number
    variacao_ano_anterior: number | null
    saida_ano_anterior: number
    ytd: number
    ytd_ano_anterior: number
    variacao_ytd: number | null
  }
  mensal: MonthPoint[]
  por_linha_negocio: { name: string; value: number }[]
  por_uf: { name: string; value: number }[]
  por_vendedor: { name: string; value: number }[]
  top_clientes: { name: string; value: number }[]
}

/** Dashboard executivo da tabela fato fiscal (Saída/Entrada/Venda) */
function MedicalDashboard() {
  const { sessionId } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<{ ano: number | null; mes: number | null; excluirIntercompany: boolean }>({
    ano: null, // null = backend escolhe o ano mais recente
    mes: null,
    excluirIntercompany: false,
  })

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    getDashboard(sessionId, {
      ano: filtro.ano ?? undefined,
      mes: filtro.mes,
      excluir_intercompany: filtro.excluirIntercompany,
    })
      .then(setData)
      .catch(() => setError("Erro ao carregar o dashboard."))
      .finally(() => setLoading(false))
  }, [sessionId, filtro])

  if (loading && !data) return <LoadingSkeleton />
  if (error) return <div className="text-danger text-sm py-8 text-center">{error}</div>
  if (!data) return null

  const { kpis, filtros } = data
  const periodo = filtros.mes ? `${fmt.monthShort(filtros.mes)}/${filtros.ano}` : `${filtros.ano}`

  return (
    <div className="flex flex-col gap-6" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
      {/* Cabeçalho + filtro de período */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-xl font-bold text-text">Dashboard Fiscal</h2>
          <p className="mt-1 mb-0 text-sm text-muted">
            Faturamento consolidado (Saída − Entrada) · período {periodo}
          </p>
        </div>
        <PeriodFilter
          anos={filtros.anos_disponiveis}
          ano={filtros.ano}
          mes={filtros.mes}
          excluirIntercompany={filtros.excluir_intercompany}
          onChange={v => setFiltro({ ano: v.ano, mes: v.mes, excluirIntercompany: v.excluirIntercompany })}
        />
      </div>

      {/* Fonte analítica + avisos de negócio (Entrada incompleta aparece aqui,
          logo acima dos KPIs de Entrada/Receita Líquida) */}
      <SourceBanner />

      {/* KPIs */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard
          title={`Saída ${periodo}`}
          total={kpis.saida}
          format="currency"
          trend={kpis.variacao_ano_anterior}
          trendLabel={`vs ${filtros.ano - 1} (${fmt.currencyCompact(kpis.saida_ano_anterior)})`}
          subtitle={`${fmt.int(kpis.documentos)} itens de nota`}
          index={0}
        />
        <KpiCard
          title="Entrada (devoluções)"
          total={kpis.entrada}
          format="currency"
          subtitle="notas de devolução"
          index={1}
        />
        <KpiCard
          title="Receita líquida"
          total={kpis.liquido}
          format="currency"
          subtitle="Saída − Entrada"
          index={2}
        />
        <KpiCard
          title={`Acumulado ${filtros.ano}${filtros.mes ? ` até ${fmt.monthShort(filtros.mes)}` : ""}`}
          total={kpis.ytd}
          format="currency"
          trend={kpis.variacao_ytd}
          trendLabel={`vs acumulado ${filtros.ano - 1} (${fmt.currencyCompact(kpis.ytd_ano_anterior)})`}
          subtitle="comparativo anual"
          index={3}
        />
      </div>

      {/* Evolução mensal */}
      <ChartCard
        title={`Evolução mensal ${filtros.ano}`}
        subtitle={`Saída × Entrada, com ${filtros.ano - 1} como referência`}
        loading={loading}
      >
        <MonthlyChart data={data.mensal} ano={filtros.ano} />
      </ChartCard>

      {/* Quebras de faturamento */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <ChartCard title="Faturamento por Linha de Negócio" subtitle="Saída no período" loading={loading}>
          <HBarChart data={data.por_linha_negocio} height={320} />
        </ChartCard>
        <ChartCard title="Faturamento por UF" subtitle="Saída no período" loading={loading}>
          <HBarChart data={data.por_uf} height={320} />
        </ChartCard>
        <ChartCard title="Faturamento por Vendedor" subtitle="top 10 · Saída no período" loading={loading}>
          <HBarChart data={data.por_vendedor} height={320} />
        </ChartCard>
        <ChartCard title="Top clientes" subtitle="top 10 · Saída no período" loading={loading}>
          <HBarChart data={data.top_clientes} height={320} />
        </ChartCard>
      </div>
    </div>
  )
}

/** Visão genérica (qualquer dataset): KPIs automáticos + saúde dos dados */
function GenericOverview() {
  const { kpis, quality, colTypes, rows, columns, datasetType, isLoading } = useSession()

  const nullPct     = quality.length > 0 ? quality.reduce((a, b) => a + b.null_pct, 0) / quality.length : 0
  const health      = Math.max(0, Math.round(100 - nullPct))
  const healthColor = health >= 90 ? "#34c97e" : health >= 70 ? "#f59e0b" : "#f87171"
  const description = typeof datasetType === "object" && datasetType ? datasetType.description : datasetType

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-text">Visão Geral</h2>
          <p className="mt-1 mb-0 text-sm text-muted">Resumo do dataset e métricas principais</p>
        </div>
        {description && (
          <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
            {String(description)}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {kpis && kpis.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {kpis.map((kpi, i) => (
            <KpiCard key={kpi.title} {...kpi} index={i} />
          ))}
        </div>
      ) : (
        <div className="bg-card/60 border border-border rounded-xl p-6 text-center text-muted text-sm">
          Nenhuma coluna numérica encontrada para KPIs.
        </div>
      )}

      {/* Info Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="bg-card/60 border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">Saúde dos Dados</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold" style={{ color: healthColor }}>{health}</span>
            <span className="text-sm text-muted mb-1">/ 100</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${health}%`, backgroundColor: healthColor }} />
          </div>
          <p className="m-0 text-[11px] text-muted">{nullPct.toFixed(1).replace(".", ",")}% de nulos em média</p>
        </div>

        <div className="bg-card/60 border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">Resumo</p>
          <div className="flex flex-col gap-2">
            {[
              ["Linhas", fmt.int(rows ?? 0)],
              ["Colunas", String(columns ?? 0)],
              ["Datas", String(colTypes?.date?.length ?? 0)],
              ["Numéricas", String(colTypes?.numeric?.length ?? 0)],
              ["Categóricas", String(colTypes?.categorical?.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[11px] text-muted">{label}</span>
                <span className="text-[11px] font-semibold text-text">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card/60 border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">Colunas com Nulos</p>
          <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
            {quality.filter(q => q.null_pct > 0).length === 0 && (
              <p className="m-0 text-[11px] text-success">✓ Nenhum nulo detectado</p>
            )}
            {quality.filter(q => q.null_pct > 0).sort((a, b) => b.null_pct - a.null_pct).slice(0, 7).map(q => (
              <div key={q.column}>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-muted max-w-[150px] truncate" title={q.column}>{q.column}</span>
                  <span className="text-[10px] text-warning">{q.null_pct.toFixed(1).replace(".", ",")}%</span>
                </div>
                <div className="h-1 bg-border rounded-sm">
                  <div className="h-1 bg-warning/60 rounded-sm" style={{ width: `${Math.min(q.null_pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column Types */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {[
          { label: "Datas", cols: colTypes?.date ?? [], color: "#06b6d4" },
          { label: "Numéricas", cols: colTypes?.numeric ?? [], color: "#4f8ef7" },
          { label: "Categóricas", cols: colTypes?.categorical ?? [], color: "#a78bfa" },
        ].map(({ label, cols, color }) => (
          <div key={label} className="bg-card/60 border border-border rounded-xl p-5 flex flex-col gap-3" style={{ borderLeft: `3px solid ${color}` }}>
            <div className="flex items-center justify-between">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
              <span className="text-[11px] font-bold" style={{ color }}>{cols.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {cols.length === 0 && <p className="m-0 text-[11px] text-faint italic">Nenhuma detectada</p>}
              {cols.slice(0, 8).map(c => (
                <p key={c} className="m-0 text-[11px] text-text truncate" title={c}>• {c}</p>
              ))}
              {cols.length > 8 && <p className="m-0 text-[11px] text-muted">+{cols.length - 8} outras</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Overview: dashboard executivo para o modelo fiscal, visão genérica para o resto
export function OverviewPage() {
  const { model } = useSession()
  return model === "medical_fiscal" ? <MedicalDashboard /> : <GenericOverview />
}
