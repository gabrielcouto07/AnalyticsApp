"use client"

import React from "react"
import { useSessionStore } from "../store/session"
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

export const DashboardPage: React.FC = () => {
  const sessionId = useSessionStore((state) => state.sessionId)
  const activeView = useSessionStore((state) => state.activeView)

  if (!sessionId) return null

  if (activeView === "efetivo") return <EfetivoDashboard sessionId={sessionId} />
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
      Vista não suportada: <strong>{activeView}</strong>
    </div>
  )
}
