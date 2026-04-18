import { useEffect, useState } from "react"
import { useSession } from "../store/session"
import {
  getAnomalies,
  getTrends,
  getClustering,
  getSegmentation,
} from "../api/analytics"

export function AdvancedAnalyticsPage() {
  const sessionId = useSession(s => s.sessionId)
  const numericCols = useSession(s => s.numericCols)

  const [selectedColumn, setSelectedColumn] = useState<string>(numericCols[0] || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Anomalies
  const [anomalies, setAnomalies] = useState<any>(null)
  const [showAnomalies, setShowAnomalies] = useState(false)

  // Trends
  const [trends, setTrends] = useState<any>(null)
  const [showTrends, setShowTrends] = useState(false)

  // Clustering
  const [clustering, setClustering] = useState<any>(null)
  const [showClustering, setShowClustering] = useState(false)

  // Segmentation
  const [segmentation, setSegmentation] = useState<any>(null)
  const [showSegmentation, setShowSegmentation] = useState(false)

  useEffect(() => {
    if (numericCols.length > 0 && !selectedColumn) {
      setSelectedColumn(numericCols[0])
    }
  }, [numericCols, selectedColumn])

  const loadAnomalies = async () => {
    if (!sessionId || !selectedColumn) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAnomalies(sessionId, selectedColumn, ["iqr", "zscore"])
      setAnomalies(data.anomaly_analysis)
      setShowAnomalies(true)
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar anomalias")
    } finally {
      setLoading(false)
    }
  }

  const loadTrends = async () => {
    if (!sessionId || !selectedColumn) return
    setLoading(true)
    setError(null)
    try {
      const data = await getTrends(sessionId, selectedColumn)
      setTrends(data.trend_analysis)
      setShowTrends(true)
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar tendências")
    } finally {
      setLoading(false)
    }
  }

  const loadClustering = async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getClustering(sessionId, 3)
      setClustering(data.clustering_analysis)
      setShowClustering(true)
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar clustering")
    } finally {
      setLoading(false)
    }
  }

  const loadSegmentation = async () => {
    if (!sessionId || !selectedColumn) return
    setLoading(true)
    setError(null)
    try {
      const data = await getSegmentation(sessionId, selectedColumn, "quartiles")
      setSegmentation(data.segmentation_analysis)
      setShowSegmentation(true)
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar segmentação")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="text-center text-slate-400 py-12">
        <p>Nenhuma sessão ativa. Faça upload de um arquivo primeiro.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-50 mb-2">Advanced Analytics</h2>
        <p className="text-sm text-slate-400">Análises avançadas com Machine Learning e estatísticas</p>
      </div>

      {/* Column Selector */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <label className="text-sm font-medium text-slate-300 mb-2 block">
          Selecione uma Coluna Numérica
        </label>
        <select
          value={selectedColumn}
          onChange={e => setSelectedColumn(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-50 rounded-md text-sm"
        >
          {numericCols.map(col => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Analysis Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={loadAnomalies}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          🔍 Detectar Anomalias
        </button>
        <button
          onClick={loadTrends}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          📈 Analisar Tendências
        </button>
        <button
          onClick={loadClustering}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          🎯 Clustering
        </button>
        <button
          onClick={loadSegmentation}
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          📊 Segmentação
        </button>
      </div>

      {/* Anomalies Results */}
      {showAnomalies && anomalies && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">🔍 Detecção de Anomalias</h3>

          <div className="grid grid-cols-2 gap-3">
            {anomalies.iqr && (
              <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                <p className="text-xs font-medium text-slate-400 uppercase">IQR</p>
                <p className="text-xl font-bold text-red-400 mt-1">{anomalies.iqr.count}</p>
                <p className="text-xs text-slate-400">{anomalies.iqr.percentage}% anomalias</p>
              </div>
            )}
            {anomalies.zscore && (
              <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                <p className="text-xs font-medium text-slate-400 uppercase">Z-Score</p>
                <p className="text-xl font-bold text-orange-400 mt-1">{anomalies.zscore.count}</p>
                <p className="text-xs text-slate-400">{anomalies.zscore.percentage}% anomalias</p>
              </div>
            )}
            {anomalies.isolation_forest && (
              <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                <p className="text-xs font-medium text-slate-400 uppercase">Isolation Forest</p>
                <p className="text-xl font-bold text-yellow-400 mt-1">
                  {anomalies.isolation_forest.anomalies}
                </p>
                <p className="text-xs text-slate-400">{anomalies.isolation_forest.percentage}% anomalias</p>
              </div>
            )}
          </div>

          {anomalies.iqr && (
            <div className="bg-slate-700/30 p-3 rounded text-xs text-slate-300">
              <p className="font-medium mb-1">Limites (IQR):</p>
              <p>Inferior: {anomalies.iqr.bounds?.lower?.toFixed(2)}</p>
              <p>Superior: {anomalies.iqr.bounds?.upper?.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Trends Results */}
      {showTrends && trends && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-slate-100">📈 Análise de Tendências</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-xs text-slate-400 uppercase font-medium">Direção</p>
              <p className="text-lg font-bold text-blue-400 mt-1">
                {trends.direction === "up" && "📈"}
                {trends.direction === "down" && "📉"}
                {trends.direction === "flat" && "→"}
                {" " + trends.direction.toUpperCase()}
              </p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-xs text-slate-400 uppercase font-medium">Força</p>
              <p className="text-lg font-bold text-purple-400 mt-1">{trends.strength}</p>
              <p className="text-xs text-slate-500">R²: {trends.r_squared}</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-xs text-slate-400 uppercase font-medium">Slope</p>
              <p className="text-lg font-bold text-green-400 mt-1">{trends.slope.toFixed(4)}</p>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            Média recente: <span className="font-bold text-cyan-400">{trends.recent_avg}</span>
          </p>
        </div>
      )}

      {/* Clustering Results */}
      {showClustering && clustering && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">🎯 Clustering K-Means</h3>

          {clustering.kmeans && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400 uppercase font-medium">Silhueta</p>
                  <p className="text-xl font-bold text-blue-400 mt-1">
                    {clustering.kmeans.silhouette_score?.toFixed(3)}
                  </p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400 uppercase font-medium">Inércia</p>
                  <p className="text-xl font-bold text-purple-400 mt-1">
                    {clustering.kmeans.inertia?.toFixed(1)}
                  </p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400 uppercase font-medium">Clusters</p>
                  <p className="text-xl font-bold text-green-400 mt-1">
                    {clustering.kmeans.n_clusters}
                  </p>
                </div>
              </div>

              {clustering.kmeans.cluster_sizes && (
                <div className="bg-slate-700/30 p-3 rounded text-sm">
                  <p className="font-medium text-slate-300 mb-2">Tamanho dos Clusters:</p>
                  {Object.entries(clustering.kmeans.cluster_sizes).map(([cluster, size]: any) => (
                    <p key={cluster} className="text-slate-400">
                      Cluster {cluster}: <span className="text-cyan-400 font-bold">{size} registros</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {clustering.pca && (
            <div className="bg-slate-700/30 p-3 rounded text-sm">
              <p className="font-medium text-slate-300 mb-2">PCA - Variância Explicada:</p>
              <p className="text-slate-400">
                Total: <span className="text-green-400 font-bold">{clustering.pca.total_variance_explained?.toFixed(2)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Segmentation Results */}
      {showSegmentation && segmentation && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">📊 Segmentação por Quartis</h3>

          <div className="space-y-2">
            {segmentation.segments &&
              Object.entries(segmentation.segments).map(([segment, count]: any) => {
                const percentage = ((count / segmentation.total) * 100).toFixed(1)
                return (
                  <div key={segment} className="flex items-center justify-between bg-slate-700/30 p-3 rounded">
                    <span className="text-sm text-slate-300 font-medium">{segment}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-cyan-400 font-bold w-12 text-right">
                        {percentage}%
                      </span>
                      <span className="text-xs text-slate-500">{count}</span>
                    </div>
                  </div>
                )
              })}
          </div>

          {segmentation.quartile_values && (
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400 space-y-1">
              <p>Q1 (25%): <span className="text-slate-300 font-mono">{segmentation.quartile_values.Q1}</span></p>
              <p>Q2 (50%): <span className="text-slate-300 font-mono">{segmentation.quartile_values.Q2}</span></p>
              <p>Q3 (75%): <span className="text-slate-300 font-mono">{segmentation.quartile_values.Q3}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">⚙️</div>
          <p className="text-slate-400 mt-2">Processando análises...</p>
        </div>
      )}
    </div>
  )
}
