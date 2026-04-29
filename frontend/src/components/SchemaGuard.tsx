import React from "react"

import { useSessionStore } from "../store/session"

interface SchemaGuardProps {
  requires: string
  children: React.ReactNode
}

export function SchemaGuard({ requires, children }: SchemaGuardProps) {
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const openUpload = useSessionStore((state) => state.openUpload)

  if (schemaTypes.includes(requires)) {
    return <>{children}</>
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "420px",
        padding: "24px",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#1e293b",
          border: "1px solid rgba(203,187,160,0.28)",
          borderRadius: 18,
          padding: "28px 24px",
          textAlign: "center",
          boxShadow: "0 20px 45px rgba(15,23,42,0.35)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>Dashboard indisponível</h2>
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.6, color: "#f8fafc" }}>
          {`Este dashboard requer dados do tipo «${requires}».`}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6, color: "#f8fafc" }}>
          Faça upload de um arquivo compatível para continuar.
        </p>
        <button
          type="button"
          onClick={openUpload}
          style={{
            marginTop: 20,
            background: "#cbbba0",
            color: "#0b4f3a",
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Novo Upload
        </button>
      </div>
    </div>
  )
}
