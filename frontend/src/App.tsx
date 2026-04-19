import { useState } from "react"
import { useSession } from "./store/session"
import { UploadZone } from "./components/UploadZone"
import { TemplateSelection } from "./components/TemplateSelection"
import { Sidebar, type PageId } from "./components/layout/Sidebar"
import {
  DashboardPage,
  OverviewPage,
  TemporalPage,
  DistributionPage,
  RankingPage,
  ExplorerPage,
  InsightsPage,
  CorrelationPage,
  QualityPage,
  DataAuditPage,
  ExportPage,
  AdvancedAnalyticsPage,
  ProfilePage,
} from "./pages"
import { ConverterPage } from "./pages/ConverterPage"
import "./App.css"

export default function App() {
  const { sessionId, selectedTemplate } = useSession()
  const [page, setPage] = useState<PageId>("dashboard")

  if (!sessionId) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center", maxWidth: "600px" }}>
          <div style={{ fontSize: "64px", marginBottom: "24px" }}>📊</div>
          <h1 style={{ color: "#3b82f6", fontSize: "40px", fontWeight: "bold", marginBottom: "16px", letterSpacing: "-1px" }}>
            Analytics Dashboard
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: "18px", lineHeight: "1.6", marginBottom: "40px" }}>
            Upload your CSV or Excel file to get started with powerful data insights.
          </p>

          <UploadZone />

          <div style={{ marginTop: "40px", padding: "24px", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
            <p style={{ color: "#3b82f6", fontSize: "13px", margin: 0, fontWeight: "600" }}>Supported formats:</p>
            <p style={{ color: "#cbd5e1", fontSize: "13px", margin: "8px 0 0 0" }}>Excel (.xlsx, .xls) • CSV • Text files • JSON</p>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedTemplate) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <TemplateSelection />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#0f172a", color: "#f1f5f9", minHeight: "100vh", display: "flex", flexDirection: "row" }}>
      {/* Left Sidebar */}
      <div style={{ width: "280px", height: "100vh", borderRight: "1px solid #334155", overflowY: "auto", backgroundColor: "#1e293b" }}>
        <Sidebar active={page} onChange={setPage} />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        {/* Top Bar */}
        <div style={{
          backgroundColor: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "16px 24px",
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px", fontWeight: "600" }}>
            {page.charAt(0).toUpperCase() + page.slice(1)}
          </h2>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px", backgroundColor: "#0f172a" }}>
          {page === "dashboard"    && <DashboardPage />}
          {page === "overview"     && <OverviewPage />}
          {page === "temporal"     && <TemporalPage />}
          {page === "distribution" && <DistributionPage />}
          {page === "ranking"      && <RankingPage />}
          {page === "explorer"     && <ExplorerPage />}
          {page === "insights"     && <InsightsPage />}
          {page === "correlation"  && <CorrelationPage />}
          {page === "quality"      && <QualityPage />}
          {page === "audit"        && <DataAuditPage />}
          {page === "advanced"     && <AdvancedAnalyticsPage />}
          {page === "profile"      && <ProfilePage />}
          {page === "export"       && <ExportPage />}
          {page === "converter"    && <ConverterPage />}
        </div>
      </div>
    </div>
  )
}
