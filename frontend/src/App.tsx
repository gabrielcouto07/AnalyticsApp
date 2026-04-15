import { useState } from 'react'
import { useSession } from './store/session'
import { UploadZone } from './components/UploadZone'
import { WelcomeUpload } from './components/WelcomeUpload'
import { KpiCard } from './components/KpiCard'
import { TemporalChart } from './components/TemporalChart'
import { CrossChart } from './components/CrossChart'
import { CorrelationChart } from './components/CorrelationChart'
import { QualityTable } from './components/QualityTable'
import { FilterSidebar } from './components/FilterSidebar'
import { ExportButton } from './components/ExportButton'
import './App.css'

type TabType = 'kpis' | 'temporal' | 'explorador' | 'correlacao' | 'qualidade'

function LoadingSkeleton() {
  return (
    <div className="space-y-8 py-12">
      {/* Loading Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/40 to-primary/20 rounded-full animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted/30 rounded w-32 animate-pulse" />
            <div className="h-3 bg-muted/20 rounded w-48 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Skeleton dos KPI cards */}
      <div>
        <div className="h-6 bg-muted/20 rounded w-48 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-5 border border-border space-y-3 animate-pulse"
            >
              <div className="h-3 bg-muted/20 rounded w-24" />
              <div className="h-8 bg-muted/20 rounded w-32" />
              <div className="h-3 bg-muted/20 rounded w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton do gráfico */}
      <div className="space-y-3">
        <div className="h-6 bg-muted/20 rounded w-40 animate-pulse" />
        <div className="bg-card rounded-xl h-72 border border-border animate-pulse" />
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" />
        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        <span className="text-muted text-sm font-medium ml-2">Processando seus dados...</span>
      </div>
    </div>
  )
}

function App() {
  const { sessionId, filename, rows, columns, colTypes, clear, kpis, quality, stats, isLoading, error } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>('kpis')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState<any>(null)

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'kpis', label: 'KPIs', icon: '📊' },
    { id: 'temporal', label: 'Temporal', icon: '📈' },
    { id: 'explorador', label: 'Explorador', icon: '🔍' },
    { id: 'correlacao', label: 'Correlação', icon: '🔗' },
    { id: 'qualidade', label: 'Qualidade', icon: '✓' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1a1f3a] to-[#0f172a]">
      {/* Header Fixo - Premium */}
      {sessionId && !isLoading && (
        <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-card/95 via-card/90 to-primary/5 backdrop-blur-xl border-b border-primary/10 z-40 shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden px-3 py-2 rounded-xl hover:bg-primary/20 transition-all text-muted hover:text-primary group"
              >
                <span className="group-hover:scale-110 inline-block transition-transform">🔍</span>
              </button>
              <div className="group">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent group-hover:from-secondary group-hover:to-primary transition-all duration-300">📊 Analytics Dashboard</h1>
                <p className="text-xs text-muted/80 mt-1">
                  <span className="inline-block mr-3 px-2 py-1 rounded bg-primary/10 text-primary/90">{filename}</span>
                  <span className="inline-block mr-3">{rows.toLocaleString("pt-BR")} linhas</span>
                  <span className="inline-block">{columns} colunas</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ExportButton sessionId={sessionId} />
              <button
                onClick={() => clear()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-danger/20 to-danger/10 text-danger hover:from-danger/30 hover:to-danger/20 transition-all font-semibold text-sm hover:scale-105 shadow-lg border border-danger/20"
              >
                ✕ Novo
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sessionId && !isLoading ? 'pt-28 pb-12' : 'pt-12 pb-8'}`}>
        {/* Filter Sidebar */}
        {sessionId && !isLoading && (
          <FilterSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onFiltersChange={setFilters}
          />
        )}

        <div className={`${sessionId ? 'max-w-7xl mx-auto px-6' : 'px-0'}`}>
        {!sessionId ? (
          // Welcome Screen com Upload
          <WelcomeUpload />
        ) : (
          // Dashboard após upload
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-danger/10 border border-danger text-danger rounded-xl p-4">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading && <LoadingSkeleton />}

            {/* Tabs Navigation - Premium */}
            {!isLoading && (
              <>
                <div className="flex gap-2 border-b border-gradient-to-r from-primary/30 via-border to-secondary/10 overflow-x-auto pb-4 scrollbar-hide relative">
                  {/* Gradient line effect */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-secondary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-3 font-semibold text-sm whitespace-nowrap transition-all rounded-xl duration-300 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-xl scale-105 border border-primary/40'
                          : 'text-muted hover:text-text hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 border border-transparent hover:border-primary/30'
                      }`}
                    >
                      <span className="text-lg mr-2">{tab.icon}</span>{tab.label}
                    </button>
                  ))}
                </div>

                {/* KPIs Tab — display:none em vez de unmount */}
                <div style={{ display: activeTab === 'kpis' ? 'block' : 'none' }} className="animate-fadeIn">
                  {kpis.length > 0 ? (
                    <div className="space-y-6">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">📊 Métricas Principais</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {kpis.map((kpi, idx) => (
                          <KpiCard
                            key={idx}
                            title={kpi.title}
                            total={kpi.total}
                            mean={kpi.mean}
                            trend={kpi.trend}
                            index={idx}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted">Nenhum KPI disponível</div>
                  )}
                </div>

                {/* Temporal Tab */}
                <div style={{ display: activeTab === 'temporal' ? 'block' : 'none' }}>
                  {colTypes?.date && colTypes.date.length > 0 && colTypes.numeric && colTypes.numeric.length > 0 ? (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-text">Série Temporal</h2>
                      <div className="bg-gradient-to-br from-card via-card/80 to-card/60 rounded-2xl p-8 border border-primary/20 shadow-2xl hover:shadow-3xl transition-all">
                        <h3 className="text-xl font-bold text-text mb-6 flex items-center gap-2"><span>📈</span> Série Temporal</h3>
                        <TemporalChart
                          sessionId={sessionId}
                          dateCol={colTypes.date[0]}
                          metricCol={colTypes.numeric[0]}
                          granularity="ME"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted">
                      Sem colunas de data ou métrica numérica para gráfico temporal
                    </div>
                  )}
                </div>

                {/* Explorador Tab */}
                <div style={{ display: activeTab === 'explorador' ? 'block' : 'none' }} className="animate-fadeIn">
                  {colTypes?.categorical && colTypes.categorical.length > 0 && colTypes.numeric && colTypes.numeric.length > 0 ? (
                    <div className="space-y-8">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">🔍 Explorador de Dados</h2>
                      <div className="bg-gradient-to-br from-card via-card/80 to-card/60 rounded-2xl p-8 border border-secondary/20 shadow-2xl hover:shadow-3xl transition-all">
                        <h3 className="text-xl font-bold text-text mb-6 flex items-center gap-2"><span>🔀</span> Análise Cruzada</h3>
                        <CrossChart
                          sessionId={sessionId}
                          catCol={colTypes.categorical[0]}
                          numCol={colTypes.numeric[0]}
                          aggFn="sum"
                          topN={20}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted">
                      Sem colunas categóricas ou numéricas para explorador
                    </div>
                  )}
                </div>

                {/* Correlação Tab */}
                <div style={{ display: activeTab === 'correlacao' ? 'block' : 'none' }} className="animate-fadeIn">
                  {colTypes?.numeric && colTypes.numeric.length >= 2 ? (
                    <div className="space-y-8">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">🔗 Matriz de Correlação</h2>
                      <div className="bg-gradient-to-br from-card via-card/80 to-card/60 rounded-2xl p-8 border border-secondary/20 shadow-2xl hover:shadow-3xl transition-all">
                        <CorrelationChart sessionId={sessionId} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted">
                      Necessário pelo menos 2 colunas numéricas para correlação
                    </div>
                  )}
                </div>

                {/* Qualidade Tab */}
                <div style={{ display: activeTab === 'qualidade' ? 'block' : 'none' }} className="animate-fadeIn">
                  {quality && quality.length > 0 ? (
                    <div className="space-y-8">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">✓ Análise de Qualidade</h2>
                      <div>
                        <QualityTable />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted">Sem dados de qualidade</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

export default App
