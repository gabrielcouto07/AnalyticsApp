"use client"

import {
  AnomaliasDashboard,
  ClusteringDashboard,
  CrossAnalysisDashboard,
  CustosDashboard,
  EfetivoDashboard,
  ExportarView,
  MedicaoDashboard,
  OrcamentoDashboard,
  ProfilerDashboard,
  SegmentacaoDashboard,
  TendenciasDashboard,
} from "../components"
import { EmptyState } from "../components/layout/EmptyState"
import { SchemaGuard } from "../components/SchemaGuard"
import { canAccessView, getViewRequirement } from "../components/layout/navigation"
import { useSessionStore } from "../store/session"

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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "420px",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "640px", width: "100%" }}>
          <EmptyState
            schemaRequired={requirement?.requiredLabel ?? "compativel"}
            requiredColumns={requirement?.columns ?? []}
            uploadedSchemas={schemaTypes}
          />
          <button
            type="button"
            onClick={openUpload}
            style={{
              marginTop: 20,
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
      </div>
    )
  }

  if (activeView === "efetivo") {
    return (
      <SchemaGuard requires="efetivo">
        <EfetivoDashboard />
      </SchemaGuard>
    )
  }
  if (activeView === "custos") {
    return (
      <SchemaGuard requires={["custos", "orcamento"]}>
        <CustosDashboard sessionId={sessionId} />
      </SchemaGuard>
    )
  }
  if (activeView === "medicao") {
    return (
      <SchemaGuard requires="medicao">
        <MedicaoDashboard sessionId={sessionId} />
      </SchemaGuard>
    )
  }
  if (activeView === "orcamento") {
    return (
      <SchemaGuard requires={["orcamento", "custos"]}>
        <OrcamentoDashboard sessionId={sessionId} />
      </SchemaGuard>
    )
  }
  if (activeView === "cross") {
    return (
      <SchemaGuard requires={["efetivo", "medicao"]}>
        <CrossAnalysisDashboard sessionId={sessionId} />
      </SchemaGuard>
    )
  }
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
