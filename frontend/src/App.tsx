import { useState } from "react"
import { useSession } from "./store/session"
import { TopBar, Sidebar, type PageId } from "./components/layout"
import { PageBoundary } from "./components/PageBoundary"
import { WelcomePage } from "./pages"
import { OverviewPage } from "./pages/OverviewPage"
import { TemporalPage } from "./pages/TemporalPage"
import { DistributionPage } from "./pages/DistributionPage"
import { RankingPage } from "./pages/RankingPage"
import { ExplorerPage } from "./pages/ExplorerPage"
import { CorrelationPage } from "./pages/CorrelationPage"
import { QualityPage } from "./pages/QualityPage"
import { ExportPage } from "./pages/ExportPage"
import "./App.css"

const PAGES: Record<PageId, { label: string; node: React.ReactNode }> = {
  overview: { label: "Visão Geral", node: <OverviewPage /> },
  temporal: { label: "Temporal", node: <TemporalPage /> },
  distribution: { label: "Distribuição", node: <DistributionPage /> },
  ranking: { label: "Ranking", node: <RankingPage /> },
  explorer: { label: "Explorador", node: <ExplorerPage /> },
  correlation: { label: "Correlação", node: <CorrelationPage /> },
  quality: { label: "Qualidade", node: <QualityPage /> },
  export: { label: "Exportação", node: <ExportPage /> },
}

export default function App() {
  const { sessionId } = useSession()
  const [page, setPage] = useState<PageId>("overview")
  // Re-upload preservando a sessão: abre o upload SEM apagar a sessão atual.
  const [showUpload, setShowUpload] = useState(false)

  const uploadView = !sessionId || showUpload

  return (
    <div style={{ backgroundColor: "#0f172a", color: "#f1f5f9", minHeight: "100vh", display: "flex", overflowX: "hidden" }}>
      {sessionId && !showUpload && (
        // flexShrink: 0 → a sidebar NUNCA encolhe quando a página tem conteúdo largo
        // (tabela do Explorer). Sem isso o flexbox espremia a sidebar até os ícones.
        <aside style={{ width: "224px", flexShrink: 0, backgroundColor: "#1e293b", borderRight: "1px solid #334155", overflowY: "auto" }}>
          <Sidebar active={page} onChange={setPage} onNewUpload={() => setShowUpload(true)} />
        </aside>
      )}
      {/* minWidth: 0 → a coluna de conteúdo pode encolher, então tabelas largas
          rolam no próprio contêiner (overflow-x) em vez de esticar o layout. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar />
        <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "24px" }}>
          {uploadView ? (
            <WelcomePage
              onSuccess={() => { setShowUpload(false); setPage("overview") }}
              onCancel={sessionId ? () => setShowUpload(false) : undefined}
            />
          ) : (
            <PageBoundary pageKey={page} pageLabel={PAGES[page].label} onBackToDashboard={() => setPage("overview")}>
              {PAGES[page].node}
            </PageBoundary>
          )}
        </main>
      </div>
    </div>
  )
}
