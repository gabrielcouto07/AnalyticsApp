// Left sidebar navigation with page links and current file info

import { useSession } from "../../store/session"

// Organized by workflow context
const NAV_GROUPS = [
  {
    title: "📊 Análise de Dados",
    pages: [
      { id: "dashboard", icon: "🎯", label: "Dashboard Principal", desc: "Visão geral com KPIs" },
      { id: "overview", icon: "📊", label: "Overview", desc: "Dados tabulares" },
      { id: "temporal", icon: "📈", label: "Série Temporal", desc: "Evolução ao longo do tempo" },
      { id: "distribution", icon: "📉", label: "Distribuição", desc: "Histogramas e densidade" },
      { id: "ranking", icon: "🏅", label: "Ranking", desc: "Top items e fornecedores" },
    ]
  },
  {
    title: "🔍 Exploração",
    pages: [
      { id: "explorer", icon: "🔍", label: "Explorador", desc: "Navegue os dados" },
      { id: "correlation", icon: "🔗", label: "Correlações", desc: "Relações entre colunas" },
      { id: "insights", icon: "💡", label: "Insights", desc: "Descobertas automáticas" },
    ]
  },
  {
    title: "⚙️ Ferramentas",
    pages: [
      { id: "converter", icon: "🔄", label: "Converter", desc: "CSV↔Excel↔JSON↔SQL" },
      { id: "quality", icon: "✅", label: "Qualidade", desc: "Data cleaning & validation" },
      { id: "profile", icon: "📋", label: "Profiler", desc: "Data profiling" },
      { id: "audit", icon: "🔎", label: "Auditoria", desc: "Histórico de mudanças" },
    ]
  },
  {
    title: "📤 Exportação",
    pages: [
      { id: "export", icon: "📥", label: "Exportar", desc: "CSV, Excel, API" },
      { id: "advanced", icon: "🚀", label: "Avançado", desc: "Customizações" },
    ]
  }
] as const

export type PageId = typeof NAV_GROUPS[number]["pages"][number]["id"]

interface SidebarProps {
  active: PageId
  onChange: (page: PageId) => void
}

export function Sidebar({ active, onChange }: SidebarProps) {
  const filename = useSession((state) => state.filename)
  const rowCount = useSession((state) => state.rowCount)
  const colCount = useSession((state) => state.colCount)
  const clearSession = useSession((state) => state.clearSession)

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#1e293b",
      color: "#f1f5f9"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid #334155",
        flexShrink: 0
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "24px" }}>📊</span>
          <div>
            <p style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: "700",
              color: "#f1f5f9",
              letterSpacing: "-0.3px"
            }}>
              Analytics Hub
            </p>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "10px",
              fontWeight: "600",
              color: "#34c97e",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              ✓ Pronto
            </p>
          </div>
        </div>
      </div>

      {/* Navigation - Organized by Groups */}
      <nav style={{
        flex: 1,
        padding: "8px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {/* Group Header */}
            <div style={{
              padding: "12px 12px 8px 12px",
              fontSize: "11px",
              fontWeight: "700",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.7px",
              userSelect: "none"
            }}>
              {group.title}
            </div>

            {/* Group Pages */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {group.pages.map(({ id, icon, label, desc }) => (
                <button
                  key={id}
                  onClick={() => onChange(id as PageId)}
                  title={desc}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: active === id ? "rgba(79, 142, 247, 0.15)" : "transparent",
                    color: active === id ? "#4f8ef7" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: active === id ? "700" : "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                    borderLeft: active === id ? "3px solid #4f8ef7" : "3px solid transparent",
                  }}
                  onMouseEnter={e => {
                    if (active !== id) {
                      e.currentTarget.style.backgroundColor = "rgba(79, 142, 247, 0.08)"
                      e.currentTarget.style.color = "#cbd5e1"
                    }
                  }}
                  onMouseLeave={e => {
                    if (active !== id) {
                      e.currentTarget.style.backgroundColor = "transparent"
                      e.currentTarget.style.color = "#94a3b8"
                    }
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </div>
                    <div style={{ 
                      fontSize: "10px", 
                      color: active === id ? "#94a3b8" : "#64748b",
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}>
                      {desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* File Info Footer */}
      <div style={{
        padding: "12px",
        borderTop: "1px solid #334155",
        flexShrink: 0,
        backgroundColor: "rgba(30, 41, 59, 0.5)"
      }}>
        <div style={{
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(51, 65, 85, 0.5)"
        }}>
          <p style={{
            margin: "0 0 6px 0",
            fontSize: "10px",
            fontWeight: "700",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            📂 Arquivo Atual
          </p>
          
          <p style={{
            margin: "0 0 2px 0",
            fontSize: "12px",
            fontWeight: "600",
            color: "#f1f5f9",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }} title={filename ?? ""}>
            {filename || "Nenhum arquivo"}
          </p>
          
          <p style={{
            margin: "0",
            fontSize: "11px",
            color: "#94a3b8",
            fontWeight: "500"
          }}>
            {rowCount?.toLocaleString("pt-BR") || 0} linhas · {colCount || 0} colunas
          </p>
        </div>
        
        <button
          onClick={clearSession}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#dc2626",
            backgroundColor: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.2)"
            e.currentTarget.style.borderColor = "rgba(220, 38, 38, 0.4)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.1)"
            e.currentTarget.style.borderColor = "rgba(220, 38, 38, 0.2)"
          }}
        >
          🔄 Novo Upload
        </button>
      </div>
    </div>
  )
}
