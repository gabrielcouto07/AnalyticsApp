import React, { useState } from "react"

import { API_BASE_URL } from "../api/client"
import { useSessionStore } from "../store/session"
import { SchemaGuard } from "./SchemaGuard"
import { EfetivoDetalhamento, EfetivoEvolucao, EfetivoFilial, EfetivoVisaoGeral } from "./efetivo"
import type { EfetivoTab } from "./efetivo/types"

const TAB_LABELS: Array<{ id: EfetivoTab; label: string }> = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "por-filial", label: "Por Filial" },
  { id: "evolucao", label: "Evolucao" },
  { id: "detalhamento", label: "Detalhamento" },
]

export const EfetivoDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EfetivoTab>("visao-geral")
  const [hasFetchedTab, setHasFetchedTab] = useState<Record<EfetivoTab, boolean>>({
    "visao-geral": true,
    "por-filial": false,
    evolucao: false,
    detalhamento: false,
  })
  const sessionId = useSessionStore((state) => state.sessionId)

  if (!sessionId) return null

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/export/${sessionId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "efetivo_export.xlsx"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Erro ao exportar Efetivo", error)
    }
  }

  return (
    <SchemaGuard requires="efetivo">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Controle de Efetivo</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>Indicadores, evolucao e detalhamento do headcount por periodo.</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            style={{
              background: "#0b4f3a",
              color: "#fff",
              border: "1px solid rgba(203,187,160,0.35)",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Exportar
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 8, gap: 16 }}>
          {TAB_LABELS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setHasFetchedTab((current) => ({ ...current, [tab.id]: true }))
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  borderBottom: isActive ? "2px solid #0b4f3a" : "2px solid transparent",
                  color: isActive ? "#0b4f3a" : "#64748b",
                  fontWeight: isActive ? 700 : 600,
                  padding: "0 2px 10px",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {hasFetchedTab["visao-geral"] && <div style={{ display: activeTab === "visao-geral" ? "block" : "none" }}><EfetivoVisaoGeral sessionId={sessionId} /></div>}
        {hasFetchedTab["por-filial"] && <div style={{ display: activeTab === "por-filial" ? "block" : "none" }}><EfetivoFilial sessionId={sessionId} /></div>}
        {hasFetchedTab.evolucao && <div style={{ display: activeTab === "evolucao" ? "block" : "none" }}><EfetivoEvolucao sessionId={sessionId} /></div>}
        {hasFetchedTab.detalhamento && <div style={{ display: activeTab === "detalhamento" ? "block" : "none" }}><EfetivoDetalhamento sessionId={sessionId} /></div>}
      </div>
    </SchemaGuard>
  )
}
