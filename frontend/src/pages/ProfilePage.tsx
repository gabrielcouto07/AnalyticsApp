import { useEffect, useState } from "react"
import { useSession } from "../store/session"
import { getDataProfile, getDataSummary, getDataIssues } from "../api/analytics"

export function ProfilePage() {
  const sessionId = useSession(s => s.sessionId)
  const [profile, setProfile] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [issues, setIssues] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'columns' | 'issues'>('summary')

  useEffect(() => {
    if (sessionId) {
      loadProfile()
    }
  }, [sessionId])

  const loadProfile = async () => {
    if (!sessionId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const [profileData, summaryData, issuesData] = await Promise.all([
        getDataProfile(sessionId),
        getDataSummary(sessionId),
        getDataIssues(sessionId)
      ])

      setProfile(profileData.data_profile)
      setSummary(summaryData.data_summary)
      setIssues(issuesData.data_issues)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar perfil')
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-50 mb-2">Data Profile</h2>
        <p className="text-sm text-slate-400">Análise de estrutura, tipos e qualidade dos dados</p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-400 uppercase">Linhas</p>
            <p className="text-2xl font-bold text-slate-50 mt-1">{summary.rows.toLocaleString()}</p>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-400 uppercase">Colunas</p>
            <p className="text-2xl font-bold text-slate-50 mt-1">{summary.columns}</p>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-400 uppercase">Nulos</p>
            <p className="text-2xl font-bold text-slate-50 mt-1">{summary.null_percentage.toFixed(1)}%</p>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-400 uppercase">Memória</p>
            <p className="text-2xl font-bold text-slate-50 mt-1">{summary.memory_mb} MB</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'summary'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          📊 Resumo
        </button>
        <button
          onClick={() => setActiveTab('columns')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'columns'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          📋 Colunas
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'issues'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          ⚠️ Problemas
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && summary && (
        <div className="space-y-4">
          {/* Column Types */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Tipos de Colunas</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(summary.column_types as Record<string, number>).map(([type, count]) => (
                <div key={type} className="bg-slate-700/50 rounded p-3 text-center">
                  <p className="text-xs text-slate-400 uppercase">{type}</p>
                  <p className="text-xl font-bold text-slate-50">{count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Problem Columns */}
          {summary.top_problem_columns.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Colunas com Problemas</h3>
              <div className="space-y-2">
                {summary.top_problem_columns.map((col: any) => (
                  <div key={col.column} className="flex items-center justify-between bg-slate-700/30 p-3 rounded text-sm">
                    <span className="text-slate-300">{col.column}</span>
                    <div className="flex items-center gap-3">
                      {col.null_pct > 0 && <span className="text-orange-400">{col.null_pct}% nulos</span>}
                      {col.issue_count > 0 && (
                        <span className="bg-red-900/30 text-red-300 px-2 py-1 rounded text-xs">
                          {col.issue_count} problema{col.issue_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality Issues */}
          {summary.data_quality_issues.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Problemas de Qualidade</h3>
              <div className="space-y-2">
                {summary.data_quality_issues.map((issue: any, idx: number) => (
                  <div key={idx} className="bg-amber-900/20 border border-amber-700/30 text-amber-200 p-3 rounded text-sm">
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Columns Tab */}
      {activeTab === 'columns' && profile?.columns && (
        <div className="space-y-3">
          {profile.columns.map((col: any) => (
            <div key={col.name} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-lg font-semibold text-slate-50">{col.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {col.data_type} • {col.total_rows.toLocaleString()} valores
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-blue-400">{(col.type_confidence * 100).toFixed(0)}%</p>
                  <p className="text-xs text-slate-400">confiança</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div>
                  <p className="text-xs text-slate-400">Únicos</p>
                  <p className="text-sm font-semibold text-slate-200">{col.unique_count} ({col.unique_pct.toFixed(1)}%)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Nulos</p>
                  <p className={`text-sm font-semibold ${col.null_pct > 20 ? 'text-orange-400' : 'text-slate-200'}`}>
                    {col.null_count} ({col.null_pct.toFixed(1)}%)
                  </p>
                </div>
                {col.numeric_stats && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Mín</p>
                      <p className="text-sm font-semibold text-slate-200">{col.numeric_stats.min}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Máx</p>
                      <p className="text-sm font-semibold text-slate-200">{col.numeric_stats.max}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Type Distribution */}
              {Object.keys(col.type_distribution).length > 1 && (
                <div className="bg-slate-700/30 p-2 rounded mb-2 text-xs">
                  <p className="text-slate-400 mb-1">Tipos encontrados:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(col.type_distribution as Record<string, number>).map(([type, count]) => (
                      <span key={type} className="bg-slate-600 text-slate-200 px-2 py-1 rounded">
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {col.issues.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/30 p-2 rounded text-xs text-red-300">
                  {col.issues.map((issue: string, idx: number) => (
                    <div key={idx}>⚠️ {issue}</div>
                  ))}
                </div>
              )}

              {/* Sample Values */}
              {col.sample_values && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Exemplos:</p>
                  <div className="flex flex-wrap gap-1">
                    {col.sample_values.map((val: string, idx: number) => (
                      <code key={idx} className="bg-slate-700/50 px-2 py-1 rounded text-xs text-slate-300">
                        {val.substring(0, 20)}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && issues && (
        <div className="space-y-4">
          {/* Data Quality Score */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Score de Qualidade</h3>
              <div className="text-right">
                <p className="text-4xl font-bold text-blue-400">{issues.data_quality_score}</p>
                <p className="text-xs text-slate-400">/ 100</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${issues.data_quality_score}%` }}
              ></div>
            </div>
          </div>

          {/* Structure Issues */}
          {issues.structure_issues.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Problemas Estruturais</h3>
              <div className="space-y-2">
                {issues.structure_issues.map((issue: any, idx: number) => (
                  <div key={idx} className="bg-slate-700/50 p-3 rounded">
                    <p className="text-sm font-medium text-slate-200">{issue.type}</p>
                    <p className="text-xs text-slate-400 mt-1">{issue.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {issue.percentage}% ({issue.count} ocorrências)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Issues */}
          {issues.column_issues.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Problemas em Colunas</h3>
              <div className="space-y-2">
                {issues.column_issues.map((col_issue: any) => (
                  <div key={col_issue.column} className="bg-slate-700/50 p-3 rounded">
                    <p className="text-sm font-medium text-slate-200">{col_issue.column}</p>
                    <div className="mt-2 space-y-1">
                      {col_issue.issues.map((issue: any, idx: number) => (
                        <div key={idx} className="text-xs text-amber-300 ml-2">
                          • {issue.issue}: {JSON.stringify(issue.details || issue.severity || issue.percentage)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Issues */}
          {issues.structure_issues.length === 0 && issues.column_issues.length === 0 && (
            <div className="bg-green-900/20 border border-green-700/30 text-green-300 p-4 rounded-lg text-center">
              ✅ Nenhum problema detectado!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
