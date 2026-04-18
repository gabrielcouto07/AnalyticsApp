/**
 * EXEMPLO: Como integrar chartCacheKey em componentes de chart
 * 
 * Este arquivo demonstra como os componentes devem ser atualizados
 * para respeitar a invalidação de cache quando filtros mudam.
 */

import { useState, useEffect } from "react"
import { useSession } from "../store/session"
import { getTemporalData, getCorrelationData, getCrossData } from "../api/analytics"

/**
 * ✅ EXEMPLO 1: Página com um Chart
 * 
 * Sempre adicione `chartCacheKey` ao dependency array
 * para que o chart refaça a query quando filtros mudam.
 */
export function TemporalChartExample() {
  const sessionId = useSession(s => s.sessionId)
  
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateCol] = useState("date")
  const [metricCol] = useState("sales")

  useEffect(() => {
    if (!sessionId) return

    const loadChart = async () => {
      setLoading(true)
      try {
        const data = await getTemporalData(sessionId, {
          date_col: dateCol,
          metric_col: metricCol,
          granularity: "ME",
        })
        setChartData(data)
      } catch (err) {
        console.error("Erro:", err)
      } finally {
        setLoading(false)
      }
    }

    loadChart()
  }, [sessionId, dateCol, metricCol])

  if (loading) return <div>Carregando...</div>
  return <div>Chart: {JSON.stringify(chartData)}</div>
}

/**
 * ✅ EXEMPLO 2: Página com Múltiplos Charts
 * 
 * Crie um hook custom para evitar repetição.
 */
function useChartData(
  chartFn: (sessionId: string, params: any) => Promise<any>,
  params: any,
  dependencies: any[] = []
) {
  const sessionId = useSession(s => s.sessionId)
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await chartFn(sessionId, params)
        setData(result)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sessionId, ...dependencies])

  return { data, loading, error }
}

/**
 * ✅ EXEMPLO 3: Usando o hook custom
 */
export function MultiChartPage() {
  // Charts refazem queries automaticamente quando chartCacheKey muda
  const temporal = useChartData(getTemporalData, {
    date_col: "date",
    metric_col: "sales",
  })

  const cross = useChartData(getCrossData, {
    cat_col: "category",
    num_col: "sales",
    top_n: 10,
  })

  const correlation = useChartData(getCorrelationData, {})

  return (
    <div>
      <div>
        {temporal.loading && "Carregando temporal..."}
        {temporal.data && <div>Temporal: {temporal.data.data?.length} pontos</div>}
        {temporal.error && <div style={{ color: "red" }}>Erro: {temporal.error}</div>}
      </div>

      <div>
        {cross.loading && "Carregando cross..."}
        {cross.data && <div>Cross: {cross.data.data?.length} categorias</div>}
      </div>

      <div>
        {correlation.loading && "Carregando correlação..."}
        {correlation.data && <div>Correlation: {correlation.data.columns?.length} colunas</div>}
      </div>
    </div>
  )
}

/**
 * ✅ EXEMPLO 4: Lógica do TopBar (mostrando contador de registros filtrados)
 */
export function TopBarExample() {
  const sessionId = useSession(s => s.sessionId)
  const rowCount = useSession(s => s.rowCount)
  const activeFilters = useSession(s => s.activeFilters)

  const [filterStatus, setFilterStatus] = useState<any>(null)

  // Recarrega status quando filtros mudam
  useEffect(() => {
    const filterCount = (activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) + (activeFilters.date_range ? 1 : 0)
    if (!sessionId || filterCount === 0) {
      setFilterStatus(null)
      return
    }

    fetch(`http://localhost:8000/api/filters/${sessionId}/status`)
      .then(r => r.json())
      .then(setFilterStatus)
      .catch(console.error)
  }, [sessionId, activeFilters.categorical?.length, activeFilters.numeric_range?.length, activeFilters.date_range])

  const filteredRows = filterStatus?.filtered_rows ?? rowCount

  return (
    <div>
      <p>Total: {rowCount}</p>
      <p>
        {filterStatus?.is_filtered
          ? `Mostrando ${filteredRows} de ${rowCount} registros`
          : `${rowCount} registros`}
      </p>
      <p>Filtros ativos: {((activeFilters.categorical?.length || 0) + (activeFilters.numeric_range?.length || 0) + (activeFilters.date_range ? 1 : 0))}</p>
    </div>
  )
}

/**
 * ✅ EXEMPLO 5: Padrão para Request com Query Params
 * 
 * Se você precisa enviar dados filtrados para o backend,
 * sempre verifique o status antes de fazer o request.
 */
// TODO: Implement export with filters
// async function exportFilteredData(sessionId: string, format: "csv" | "xlsx") {
  // // 1. Verificar status de filtros
  // const statusResponse = await fetch(
  //   `http://localhost:8000/api/filters/${sessionId}/status`
  // )
  // const status = await statusResponse.json()

  // // 2. Mostrar confirmação se há filtros ativos
  // if (status.is_filtered) {
  //   const confirm = window.confirm(
  //     `Exportar apenas ${status.filtered_rows} registros filtrados de ${status.total_rows}?`
  //   )
  //   if (!confirm) return
  // }

  // // 3. Fazer export (backend automaticamente usa df_filtered)
  // const url = `http://localhost:8000/api/export/${sessionId}/${format}`
  // window.location.href = url
// }

/**
 * ✅ EXEMPLO 6: Invalidar cache manualmente (se necessário)
 */
// NOTE: invalidateCharts() method no longer exists in session store
// Charts are automatically invalidated when filters change via chartCacheKey

/**
 * 🎯 CHECKLIST DE INTEGRAÇÃO
 * 
 * Ao atualizar um componente de chart:
 * 
 * [ ] Importe `chartCacheKey` do Zustand
 * [ ] Adicione `chartCacheKey` ao dependency array
 * [ ] Teste aplicando filtro → chart deve atualizar
 * [ ] Teste limpando filtros → chart volta ao original
 * [ ] Verifique console para erros
 * 
 * Exemplo correto:
 * 
 *   const chartCacheKey = useSession(s => s.chartCacheKey)
 *   
 *   useEffect(() => {
 *     loadChart()
 *   }, [sessionId, otherParams, chartCacheKey])
 */
