"use client"

import { useSessionStore } from "../store/session"
import { canAccessView, getViewRequirement } from "../components/layout/navigation"
import {
  AnomaliasDashboard,
  ClusteringDashboard,
  CustosDashboard,
  EfetivoDashboard,
  ExportarView,
  OrcamentoDashboard,
  ProfilerDashboard,
  SegmentacaoDashboard,
  TendenciasDashboard,
} from "../components"

export function DashboardPage() {
  const sessionId = useSessionStore((state) => state.sessionId)
  const activeView = useSessionStore((state) => state.activeView)
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const openUpload = useSessionStore((state) => state.openUpload)

  if (!sessionId) return null

  if (!canAccessView(activeView, schemaTypes)) {
    const requirement = getViewRequirement(activeView)

    return (
      <div
        style={{
          background: "linear-gradient(180deg, rgba(7,38,28,0.96), rgba(11,79,58,0.92))",
          border: "1px solid rgba(203,187,160,0.18)",
          borderRadius: 22,
          padding: 28,
          color: "#f8fafc",
          boxShadow: "0 20px 50px rgba(11,79,58,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(203,187,160,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            ⛶
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
              Dashboard indisponivel para esta sessao
            </h3>
            <p style={{ margin: "8px 0 0", color: "rgba(241,245,249,0.88)", fontSize: 14, lineHeight: 1.6 }}>
              {requirement?.message ?? "Este dashboard nao esta disponivel para o schema carregado."}
            </p>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#cbbba0", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Colunas esperadas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "rgba(241,245,249,0.88)", lineHeight: 1.6 }}>
            Use um arquivo compativel com a visao selecionada, ou continue navegando pelas areas de Analytics, Profiler e Exportacao, que permanecem disponiveis.
          </p>
        </div>

        <button
          type="button"
          onClick={openUpload}
          style={{
            border: "1px solid rgba(203,187,160,0.4)",
            background: "#cbbba0",
            color: "#0b4f3a",
            borderRadius: 12,
            padding: "11px 16px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Novo Upload
        </button>
      </div>
    )
  }

  if (activeView === "efetivo" && sessionId) return <EfetivoDashboard sessionId={sessionId} />
  if (activeView === "custos") return <CustosDashboard sessionId={sessionId} />
  if (activeView === "orcamento") return <OrcamentoDashboard sessionId={sessionId} />
  if (activeView === "anomalias") return <AnomaliasDashboard sessionId={sessionId} />
  if (activeView === "tendencias") return <TendenciasDashboard sessionId={sessionId} />
  if (activeView === "segmentacao") return <SegmentacaoDashboard sessionId={sessionId} />
  if (activeView === "clustering") return <ClusteringDashboard sessionId={sessionId} />
  if (activeView === "profiler") return <ProfilerDashboard sessionId={sessionId} />
  if (activeView === "exportar") return <ExportarView sessionId={sessionId} />

  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(11,79,58,0.12)",
        borderRadius: 12,
        padding: 20,
        color: "#64748b",
      }}
    >
      Vista nao suportada: <strong>{activeView}</strong>
    </div>
  )
}
