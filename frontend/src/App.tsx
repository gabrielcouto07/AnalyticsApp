import { useState } from "react"
import { useSession } from "./store/session"
import { TopBar, Sidebar, type PageId } from "./components/layout"
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

const PAGES: Record<PageId, React.ReactNode> = {
  overview: <OverviewPage />,
  temporal: <TemporalPage />,
  distribution: <DistributionPage />,
  ranking: <RankingPage />,
  explorer: <ExplorerPage />,
  correlation: <CorrelationPage />,
  quality: <QualityPage />,
  export: <ExportPage />,
}

export default function App() {
  const { sessionId } = useSession()
  const [page, setPage] = useState<PageId>("overview")
  
  return (
    <div style={{ backgroundColor: "#0f172a", color: "#f1f5f9", minHeight: "100vh", display: "flex" }}>
      {sessionId && (
        <aside style={{ width: "224px", backgroundColor: "#1e293b", borderRight: "1px solid #334155", overflowY: "auto" }}>
          <Sidebar active={page} onChange={setPage} />
        </aside>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar />
        <main style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {!sessionId ? (
            <WelcomePage />
          ) : (
            PAGES[page]
          )}
        </main>
      </div>
    </div>
  )
}
