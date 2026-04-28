"use client"

import { useSessionStore } from "../../store/session"

type NavSection = {
  title: string
  items: Array<{
    id: string
    label: string
    icon: string
  }>
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "DASHBOARDS",
    items: [
      { id: "efetivo", label: "Efetivo", icon: "📊" },
      { id: "custos", label: "Custos", icon: "💰" },
      { id: "orcamento", label: "Orçamento", icon: "📋" },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { id: "anomalias", label: "Detecção de Anomalias", icon: "🔍" },
      { id: "tendencias", label: "Tendências & Previsão", icon: "📈" },
      { id: "segmentacao", label: "Segmentação", icon: "🧩" },
      { id: "clustering", label: "Clustering / PCA", icon: "🗂️" },
    ],
  },
  {
    title: "DADOS",
    items: [
      { id: "profiler", label: "Data Profiler", icon: "🔬" },
      { id: "exportar", label: "Exportar", icon: "📤" },
    ],
  },
]

export function Sidebar() {
  const sessionId = useSessionStore((state) => state.sessionId)
  const filename = useSessionStore((state) => state.filename)
  const rowCount = useSessionStore((state) => state.rowCount)
  const colCount = useSessionStore((state) => state.colCount)
  const activeView = useSessionStore((state) => state.activeView)
  const setActiveView = useSessionStore((state) => state.setActiveView)
  const clearSession = useSessionStore((state) => state.clearSession)

  const hasSession = Boolean(sessionId)

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b4f3a",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>📊</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>
              ERP Analytics
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "10px",
                fontWeight: 700,
                color: "#cbbba0",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Gestão de obra
            </p>
          </div>
        </div>
      </div>

      <nav
        style={{
          flex: 1,
          padding: "8px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p
              style={{
                margin: "14px 12px 6px",
                fontSize: "9px",
                fontWeight: 800,
                color: "#cbbba0",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!hasSession}
                  onClick={() => {
                    if (hasSession) setActiveView(item.id)
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    border: "none",
                    borderLeft: isActive ? "3px solid #cbbba0" : "3px solid transparent",
                    borderRadius: "0 8px 8px 0",
                    background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                    color: isActive ? "#fff" : "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: hasSession ? "pointer" : "not-allowed",
                    opacity: hasSession ? 1 : 0.35,
                    textAlign: "left",
                    transition: "background 150ms ease, color 150ms ease",
                  }}
                >
                  <span style={{ width: 20, fontSize: "15px", textAlign: "center" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: "16px",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "10px",
            fontWeight: 800,
            color: "#cbbba0",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          ARQUIVO
        </p>
        <p
          title={filename ?? ""}
          style={{
            margin: "0 0 4px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#e2e8f0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename || "Nenhum arquivo"}
        </p>
        <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#cbd5e1", fontWeight: 500 }}>
          {rowCount.toLocaleString("pt-BR")} linhas x {colCount.toLocaleString("pt-BR")} colunas
        </p>
        <button
          type="button"
          onClick={clearSession}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#0b4f3a",
            backgroundColor: "#cbbba0",
            border: "1px solid rgba(203,187,160,0.35)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Novo Upload
        </button>
      </div>
    </div>
  )
}
