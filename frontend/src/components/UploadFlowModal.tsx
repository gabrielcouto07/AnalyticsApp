"use client"

import { UploadZone } from "./UploadZone"

interface UploadFlowModalProps {
  onClose: () => void
}

export function UploadFlowModal({ onClose }: UploadFlowModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "rgba(255,255,255,0.97)",
          border: "1px solid rgba(11,79,58,0.16)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: "#0b4f3a",
              }}
            >
              Novo upload
            </p>
            <h2 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 28, fontWeight: 800 }}>
              Adicione outra sessao sem perder as anteriores
            </h2>
            <p style={{ margin: "10px 0 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              O arquivo novo entra na lista de sessoes e vira a sessao ativa automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid rgba(11,79,58,0.16)",
              background: "#fff",
              color: "#0b4f3a",
              borderRadius: 999,
              width: 36,
              height: 36,
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Fechar upload"
          >
            ×
          </button>
        </div>

        <UploadZone />
      </div>
    </div>
  )
}
