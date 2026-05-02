"use client"

import { useMemo } from "react"

import { fmtNum } from "../../lib/formatters"
import { useSessionStore } from "../../store/session"
import { getVisibleNavSections } from "./navigation"

const BRAND_GREEN = "#0B4F3A"

function formatSchemaLabel(value: string) {
  if (value === "generic") return "GENERICO"
  if (value === "medicao") return "MEDICAO"
  if (value === "orcamento") return "ORCAMENTO"
  return value.toUpperCase()
}

function schemaBadgeStyle(schema: string): React.CSSProperties {
  if (schema === "efetivo") return { background: "rgba(59,130,246,0.16)", color: "#BFDBFE" }
  if (schema === "medicao") return { background: "rgba(168,85,247,0.18)", color: "#E9D5FF" }
  if (schema === "custos") return { background: "rgba(249,115,22,0.18)", color: "#FED7AA" }
  if (schema === "orcamento") return { background: "rgba(34,197,94,0.18)", color: "#BBF7D0" }
  return { background: "rgba(148,163,184,0.14)", color: "#E2E8F0" }
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
  const visibleSections = useMemo(() => getVisibleNavSections(schemaTypes), [schemaTypes])

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BRAND_GREEN,
        color: "#F8FAFC",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>ERP Analytics</p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: "rgba(255,255,255,0.72)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              Gestao de obra
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {schemaTypes.length === 0 && (
          <div
            style={{
              borderRadius: 14,
              border: "1px dashed rgba(255,255,255,0.18)",
              padding: 14,
              color: "rgba(255,255,255,0.78)",
              fontSize: 12,
              lineHeight: 1.6,
              margin: "8px 4px 16px",
            }}
          >
            Faca upload de um arquivo para abrir automaticamente o dashboard mais relevante.
          </div>
        )}

        {visibleSections.map((section) => (
          <div key={section.title} style={{ marginBottom: 12 }}>
            <p
              style={{
                margin: "12px 12px 8px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.64)",
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </p>

            {section.items.map((item) => {
              const isActive = activeView === item.id
              const disabled = sessionEntries.length === 0
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setActiveView(item.id)
                  }}
                  title={item.description ?? item.label}
                  style={{
                    width: "100%",
                    marginBottom: 4,
                    padding: "12px 12px 12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 12,
                    border: "none",
                    borderLeft: `3px solid ${isActive ? item.color ?? "#FFFFFF" : "transparent"}`,
                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    color: disabled ? "rgba(255,255,255,0.45)" : "#E2E8F0",
                    cursor: disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 20, textAlign: "center", fontSize: 16 }}>{item.icon}</span>
                  <span style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 700 }}>{item.label}</span>
                    {item.description && (
                      <span
                        style={{
                          fontSize: 11,
                          color: disabled ? "rgba(255,255,255,0.36)" : "rgba(255,255,255,0.62)",
                        }}
                      >
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.64)",
            textTransform: "uppercase",
          }}
        >
          Sessoes
        </p>

        <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: sessionEntries.length > 4 ? "auto" : "visible" }}>
          {sessionEntries.length === 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.18)",
                padding: 14,
                color: "rgba(255,255,255,0.78)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Nenhum arquivo ativo ainda.
            </div>
          )}

          {sessionEntries.map((entry) => {
            const isActive = entry.sessionId === activeSessionId
            return (
              <div
                key={entry.sessionId}
                style={{
                  borderRadius: 14,
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
                      color: "#FFFFFF",
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
                      {fmtNum(entry.rowCount)} linhas x {fmtNum(entry.colCount)} colunas
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover sessao ${entry.filename}`}
                    onClick={() => removeSession(entry.sessionId)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "rgba(255,255,255,0.70)",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    x
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {entry.schemaTypes.map((schema) => (
                    <span
                      key={`${entry.sessionId}-${schema}`}
                      style={{
                        ...schemaBadgeStyle(schema),
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      {formatSchemaLabel(schema)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{filename || "Nenhum arquivo ativo"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
            {activeSessionId ? `${fmtNum(rowCount)} linhas x ${fmtNum(colCount)} colunas` : "Aguardando upload"}
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
            borderRadius: 10,
            border: "none",
            background: "#FFFFFF",
            color: BRAND_GREEN,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + Adicionar arquivo
        </button>
      </div>
    </div>
  )
}
