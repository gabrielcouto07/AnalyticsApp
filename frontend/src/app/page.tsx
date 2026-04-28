"use client"

import { useSessionStore } from "../store/session"
import { UploadZone } from "../components/UploadZone"
import { Sidebar } from "../components/layout/Sidebar"
import { DashboardPage } from "../views"

const VIEW_TITLES: Record<string, string> = {
  efetivo: "Efetivo",
  custos: "Custos",
  orcamento: "Orçamento",
  anomalias: "Detecção de Anomalias",
  tendencias: "Tendências & Previsão",
  segmentacao: "Segmentação",
  clustering: "Clustering / PCA",
  profiler: "Data Profiler",
  exportar: "Exportar Dados",
}

export default function Page() {
  const sessionId = useSessionStore((state) => state.sessionId)
  const activeView = useSessionStore((state) => state.activeView)
  const title = VIEW_TITLES[activeView] ?? "Dashboard ERP"

  if (!sessionId) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "680px",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(11,79,58,0.12)",
            borderRadius: "20px",
            padding: "34px",
            boxShadow: "0 16px 40px rgba(11,79,58,0.12)",
          }}
        >
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>🏗️</div>
          <h1
            style={{
              color: "#0b4f3a",
              fontSize: "40px",
              fontWeight: 800,
              marginBottom: "14px",
            }}
          >
            ERP Analytics
          </h1>
          <p style={{ color: "#334155", fontSize: "18px", lineHeight: 1.6, marginBottom: "36px" }}>
            Faça upload de Custos, Efetivo ou Orçamento para começar.
          </p>
          <UploadZone />
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              backgroundColor: "rgba(31,122,90,0.08)",
              borderRadius: "12px",
              border: "1px solid rgba(11,79,58,0.15)",
            }}
          >
            <p style={{ color: "#0b4f3a", fontSize: "13px", margin: 0, fontWeight: 700 }}>
              Formatos suportados:
            </p>
            <p style={{ color: "#334155", fontSize: "13px", margin: "8px 0 0" }}>
              Excel (.xlsx, .xls, .xlsm), CSV, TXT e JSON
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ color: "#0f172a", minHeight: "100vh", display: "flex", flexDirection: "row" }}>
      <div
        style={{
          width: "280px",
          height: "100vh",
          borderRight: "1px solid rgba(11,79,58,0.2)",
          overflowY: "auto",
          backgroundColor: "#0b4f3a",
          flexShrink: 0,
        }}
      >
        <Sidebar />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.86)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(11,79,58,0.16)",
            padding: "16px 24px",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "18px", fontWeight: 700 }}>
            {title}
          </h2>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <DashboardPage />
        </div>
      </div>
    </div>
  )
}
