import React, { useState } from "react"

import { API_BASE_URL } from "../api/client"
import { EmptyState } from "./layout/EmptyState"
import { SCHEMA_REQUIRED_COLUMNS } from "./layout/schemaRequirements"
import { useSessionStore } from "../store/session"
import {
  EfetivoDetalhamento,
  EfetivoEvolucao,
  EfetivoFilial,
  EfetivoVisaoGeral,
} from "./efetivo"
import type { EfetivoTab } from "./efetivo/types"

const TAB_LABELS: Array<{ id: EfetivoTab; label: string }> = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "por-filial", label: "Por Filial" },
  { id: "evolucao", label: "Evolução" },
  { id: "detalhamento", label: "Detalhamento" },
]

export const EfetivoDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EfetivoTab>("visao-geral")
  const sessionId = useSessionStore((state) => state.sessionId)
  const schemaTypes = useSessionStore((state) => state.schemaTypes)

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

  if (!schemaTypes.includes("efetivo")) {
    return (
      <EmptyState
        schemaRequired="efetivo"
        requiredColumns={SCHEMA_REQUIRED_COLUMNS.efetivo}
        uploadedSchemas={schemaTypes}
      />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
            🏗️ Controle de Efetivo
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Indicadores, evolução e detalhamento do headcount por período.
          </p>
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
          ⬇ Exportar
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 8, gap: 16 }}>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === tab.id ? "2px solid #0b4f3a" : "2px solid transparent",
              color: activeTab === tab.id ? "#0b4f3a" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 600,
              padding: "0 2px 10px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "visao-geral" && <EfetivoVisaoGeral sessionId={sessionId} />}
      {activeTab === "por-filial" && <EfetivoFilial sessionId={sessionId} />}
      {activeTab === "evolucao" && <EfetivoEvolucao sessionId={sessionId} />}
      {activeTab === "detalhamento" && <EfetivoDetalhamento sessionId={sessionId} />}
    </div>
  )
}
