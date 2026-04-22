import { useSession } from "./store/session"
import { UploadZone } from "./components/UploadZone"
import { TemplateSelection } from "./components/TemplateSelection"
import { Sidebar } from "./components/layout/Sidebar"
import { DashboardPage } from "./pages"
import "./App.css"

export default function App() {
  const { sessionId, selectedTemplate } = useSession()

  if (!sessionId) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center", maxWidth: "600px" }}>
          <div style={{ fontSize: "64px", marginBottom: "24px" }}>📊</div>
          <h1 style={{ color: "#4f8ef7", fontSize: "40px", fontWeight: "bold", marginBottom: "16px", letterSpacing: "-1px" }}>
            Analytics Dashboard
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: "18px", lineHeight: "1.6", marginBottom: "40px" }}>
            Upload your Custos, Efetivo, or Orçamento file to get started.
          </p>

          <UploadZone />

          <div style={{ marginTop: "40px", padding: "24px", backgroundColor: "rgba(79, 142, 247, 0.1)", borderRadius: "12px", border: "1px solid rgba(79, 142, 247, 0.2)" }}>
            <p style={{ color: "#4f8ef7", fontSize: "13px", margin: 0, fontWeight: "600" }}>Supported formats:</p>
            <p style={{ color: "#cbd5e1", fontSize: "13px", margin: "8px 0 0 0" }}>Excel (.xlsx, .xls, .xlsm)</p>
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
      <div style={{ width: "280px", height: "100vh", borderRight: "1px solid #334155", overflowY: "auto" }}>
        <Sidebar />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px", flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px", fontWeight: "600" }}>Dashboard</h2>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <DashboardPage />
        </div>
      </div>
    </div>
  )
}
