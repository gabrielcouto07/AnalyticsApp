"use client"

import { useMemo } from "react"

import { NAV_SECTIONS } from "./navigation"
import { fmtNum } from "../../lib/formatters"
import { useSessionStore } from "../../store/session"

const BRAND_GREEN = "#0b4f3a"

function formatSchemaLabel(value: string) {
  if (value === "generic") return "GENERICO"
  return value.toUpperCase()
}

function schemaBadgeStyle(schema: string): React.CSSProperties {
  if (schema === "efetivo") {
    return { background: "rgba(11,79,58,0.12)", color: "#0b4f3a" }
  }
  if (schema === "custos") {
    return { background: "rgba(79,142,247,0.12)", color: "#1d4ed8" }
  }
  if (schema === "orcamento") {
    return { background: "rgba(245,166,35,0.12)", color: "#92400e" }
  }
  return { background: "rgba(148,163,184,0.14)", color: "#475569" }
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

  const sessionEntries = useMemo(() => Object.values(sessions), [sessions])
  const visibleSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      if (section.title === "DASHBOARDS" && schemaTypes.length === 0) {
        return { ...section, items: [] }
      }
      return {
        ...section,
        items: section.items.filter(
          (item) => !item.requires || item.requires.some((schema) => schemaTypes.includes(schema)),
        ),
      }
    })
  }, [schemaTypes])

  const visibleSessions = sessionEntries.slice(0, 6)

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BRAND_GREEN,
        color: "#f8fafc",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.14)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff" }}>ERP Analytics</p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                fontWeight: 800,
                color: "rgba(255,255,255,0.70)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
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
          padding: 8,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {schemaTypes.length === 0 && (
          <div
            style={{
              borderRadius: 12,
              border: "1px dashed rgba(255,255,255,0.18)",
              padding: 14,
              color: "rgba(255,255,255,0.72)",
              fontSize: 12,
              lineHeight: 1.6,
              margin: "8px 4px",
            }}
          >
            Faça upload de um arquivo para ver os dashboards disponíveis.
          </div>
        )}
        {visibleSections.filter((section) => section.items.length > 0).map((section) => (
          <div key={section.title}>
            <p
              style={{
                margin: "14px 12px 6px",
                fontSize: 10,
                fontWeight: 800,
                color: "rgba(255,255,255,0.66)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = activeView === item.id
              const isSchemaLocked = sessionEntries.length === 0 && Boolean(item.requires?.length)
              const disabled = sessionEntries.length === 0
              return (
                <button
                  key={item.id}
                  type="button"
                  title={isSchemaLocked ? `Faça upload de um arquivo ${item.requires?.[0]}` : item.label}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setActiveView(item.id)
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: 10,
                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    color: isSchemaLocked ? "rgba(255,255,255,0.36)" : isActive ? "#fff" : "#dbe5ec",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 700,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled && !isSchemaLocked ? 0.6 : 1,
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 20, textAlign: "center", fontSize: 15 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {isSchemaLocked && <span style={{ marginLeft: "auto", fontSize: 11 }}>🔒</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.14)", flexShrink: 0 }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10,
            fontWeight: 800,
            color: "rgba(255,255,255,0.66)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Sessões
        </p>

        <div style={{ maxHeight: 216, overflowY: sessionEntries.length > 6 ? "auto" : "visible", display: "grid", gap: 8 }}>
          {visibleSessions.map((entry) => {
            const isActive = entry.sessionId === activeSessionId
            return (
              <div
                key={entry.sessionId}
                style={{
                  borderRadius: 12,
                  background: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => switchSession(entry.sessionId)}
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      color: "#fff",
                      textAlign: "left",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={entry.filename}
                    >
                      {entry.filename}
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
                      {fmtNum(entry.rowCount)} linhas × {fmtNum(entry.colCount)} colunas
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover sessão ${entry.filename}`}
                    onClick={() => removeSession(entry.sessionId)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "rgba(255,255,255,0.72)",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {entry.schemaTypes.map((schema) => (
                    <span
                      key={`${entry.sessionId}-${schema}`}
                      style={{
                        ...schemaBadgeStyle(schema),
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {formatSchemaLabel(schema)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}

          {sessionEntries.length === 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.18)",
                padding: 14,
                color: "rgba(255,255,255,0.72)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Faça upload de um arquivo para liberar os dashboards por schema.
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fff" }}>{filename || "Nenhum arquivo ativo"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
            {activeSessionId ? `${fmtNum(rowCount)} linhas × ${fmtNum(colCount)} colunas` : "Aguardando upload"}
            {format ? ` • ${format}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={openUpload}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 700,
            color: BRAND_GREEN,
            background: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          ＋ Adicionar arquivo
        </button>
      </div>
    </div>
  )
}
