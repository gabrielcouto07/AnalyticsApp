import { useState, ReactNode } from "react"

export interface ExplainerContent {
  title: string
  definition: string
  calculation?: string
  value: string | number
  source?: string
  details?: Record<string, any>
}

interface ExplainerModalProps {
  isOpen: boolean
  onClose: () => void
  content: ExplainerContent
}

export function ExplainerModal({ isOpen, onClose, content }: ExplainerModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(51, 65, 85, 0.8)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "500px",
          width: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          zIndex: 1000,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
          animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontSize: "24px",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#cbd5e1")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
        >
          ✕
        </button>

        {/* Content */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: 700, color: "#f1f5f9" }}>
          {content.title}
        </h2>

        {/* Main value highlight */}
        <div
          style={{
            backgroundColor: "rgba(79, 142, 247, 0.1)",
            border: "1px solid rgba(79, 142, 247, 0.3)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>
            Valor Atual
          </p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: 700, color: "#4f8ef7" }}>
            {content.value}
          </p>
        </div>

        {/* Definition */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            O que é?
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#cbd5e1", lineHeight: 1.6 }}>
            {content.definition}
          </p>
        </div>

        {/* Calculation */}
        {content.calculation && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Como é calculado?
            </h3>
            <pre
              style={{
                margin: 0,
                padding: "12px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#34c97e",
                fontSize: "12px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            >
              {content.calculation}
            </pre>
          </div>
        )}

        {/* Details */}
        {content.details && Object.keys(content.details).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Detalhes
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {Object.entries(content.details).map(([key, value]) => (
                <div key={key} style={{ padding: "10px", backgroundColor: "rgba(51, 65, 85, 0.3)", borderRadius: "8px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
                    {key}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {content.source && (
          <div style={{ paddingTop: "16px", borderTop: "1px solid #334155" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              📊 Fonte: {content.source}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  )
}

// Hook for easy modal management
export function useExplainerModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState<ExplainerContent | null>(null)

  const open = (explainerContent: ExplainerContent) => {
    setContent(explainerContent)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
  }

  return { isOpen, open, close, content }
}
