"use client"

import { useSessionStore } from "../../store/session"
import { getVisibleNavSections } from "./navigation"

function formatSchemaLabel(value: string) {
  if (value === "generic") return "Generico"
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function Sidebar() {
  const sessions = useSessionStore((state) => state.sessions)
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const filename = useSessionStore((state) => state.filename)
  const format = useSessionStore((state) => state.format)
  const rowCount = useSessionStore((state) => state.rowCount)
  const colCount = useSessionStore((state) => state.colCount)
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const activeView = useSessionStore((state) => state.activeView)
  const setActiveView = useSessionStore((state) => state.setActiveView)
  const switchSession = useSessionStore((state) => state.switchSession)
  const removeSession = useSessionStore((state) => state.removeSession)
  const openUpload = useSessionStore((state) => state.openUpload)

  const sessionEntries = Object.values(sessions)
  const visibleSections = getVisibleNavSections(schemaTypes)
  const hasSession = Boolean(activeSessionId)
  const schemaLabel =
    schemaTypes.length > 0 ? schemaTypes.map(formatSchemaLabel).join(" + ") : "Sem schema detectado"
  const hasDashboardItems = visibleSections.some((section) => section.title === "DASHBOARDS")

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
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>ERP Analytics</p>
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
              Gestao de obra
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
        {!hasDashboardItems && hasSession && (
          <div
            style={{
              margin: "8px",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid rgba(203,187,160,0.2)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#fff" }}>
              Faca upload de um arquivo compativel
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "11px", lineHeight: 1.5, color: "#cbd5e1" }}>
              Nenhum dashboard especifico foi liberado para esta sessao. Os modulos de Analytics e Dados continuam disponiveis.
            </p>
          </div>
        )}

        {visibleSections.map((section) => (
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
                    borderRadius: "8px",
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
          <p
            title={filename ?? ""}
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
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
          {format && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: "999px",
                backgroundColor: "rgba(203,187,160,0.18)",
                color: "#cbbba0",
                border: "1px solid rgba(203,187,160,0.25)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                flexShrink: 0,
              }}
            >
              {format}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              padding: "4px 8px",
              borderRadius: "999px",
              backgroundColor: "rgba(31,122,90,0.18)",
              color: "#d1fae5",
              border: "1px solid rgba(34,197,94,0.25)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {schemaLabel}
          </span>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#cbd5e1", fontWeight: 500 }}>
          {hasSession
            ? `${rowCount.toLocaleString("pt-BR")} linhas x ${colCount.toLocaleString("pt-BR")} colunas`
            : "Aguardando upload"}
        </p>

        {sessionEntries.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {sessionEntries.map((entry) => {
              const isActive = entry.sessionId === activeSessionId

              return (
                <div
                  key={entry.sessionId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    overflow: "hidden",
                    border: isActive
                      ? "1px solid rgba(203,187,160,0.45)"
                      : "1px solid rgba(255,255,255,0.14)",
                    background: isActive ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => switchSession(entry.sessionId)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: isActive ? 800 : 600,
                      padding: "6px 10px",
                      cursor: "pointer",
                      maxWidth: 150,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={entry.filename}
                  >
                    {entry.filename}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(entry.sessionId)}
                    aria-label={`Remover sessao ${entry.filename}`}
                    style={{
                      border: "none",
                      background: "rgba(15,23,42,0.2)",
                      color: "#f8fafc",
                      padding: "0 9px",
                      height: 28,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    x
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={openUpload}
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
