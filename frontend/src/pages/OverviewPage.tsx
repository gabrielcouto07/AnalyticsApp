import { useEffect } from "react"
import { useSession } from "../store/session"
import { KpiCard } from "../components"
import { OverviewAnalytics } from "../components/OverviewAnalytics"
import { fmt } from "../lib/format"
import "../components/Analytics.css"

// Overview dashboard with KPIs and health score
export function OverviewPage() {
  const { kpis, quality, colTypes, rowCount, colCount, sessionId } = useSession()

  useEffect(() => {
    console.log("[OverviewPage] kpis:", kpis)
    console.log("[OverviewPage] sessionId:", sessionId)
  }, [kpis, sessionId])

  // Count column types from colTypes object
  const dateCols = Object.entries(colTypes || {}).filter(([, type]) => type === 'date').map(([name]) => name)
  const numericCols = Object.entries(colTypes || {}).filter(([, type]) => type === 'numeric').map(([name]) => name)
  const categoricalCols = Object.entries(colTypes || {}).filter(([, type]) => type === 'categorical').map(([name]) => name)

  const nullPct     = quality.length > 0 ? quality.reduce((a, b) => a + b.null_pct, 0) / quality.length : 0
  const health      = Math.max(0, Math.round(100 - nullPct))
  const healthColor = health >= 90 ? "#10b981" : health >= 70 ? "#f59e0b" : "#ef4444"
  const healthStatus = health >= 90 ? "Excelente" : health >= 70 ? "Bom" : health >= 50 ? "Regular" : "Crítico"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", paddingBottom: "40px" }}>
      {/* Header Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "32px" }}>📊</span>
          <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#f1f5f9" }}>Dataset Overview</h1>
        </div>
        <p style={{ margin: 0, fontSize: "15px", color: "#94a3b8" }}>Resumo executivo dos dados e métricas principais do seu arquivo</p>
      </div>

      {/* Primary Metrics - Main KPI Cards */}
      {kpis && kpis.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      ) : null}

      {/* Health & Summary Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* Data Quality Card - Primary Focus */}
        <div style={{ 
          backgroundColor: "linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.7) 100%)", 
          border: "1px solid #334155", 
          borderRadius: "16px", 
          padding: "28px", 
          display: "flex", 
          flexDirection: "column", 
          gap: "20px",
          backdropFilter: "blur(8px)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>🏥 Data Quality</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>Estado da integridade dos dados</p>
            </div>
            <div style={{ 
              backgroundColor: healthColor, 
              width: "40px", 
              height: "40px", 
              borderRadius: "50%", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              opacity: 0.2
            }} />
          </div>
          
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "48px", fontWeight: "900", color: healthColor, lineHeight: 1 }}>{health}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "#cbd5e1", fontSize: "13px", fontWeight: "600" }}>/ 100</span>
              <span style={{ color: healthColor, fontSize: "12px", fontWeight: "700" }}>{healthStatus}</span>
            </div>
          </div>
          
          <div style={{ height: "8px", backgroundColor: "rgba(51, 65, 85, 0.4)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: "999px", width: `${health}%`, backgroundColor: healthColor, transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)", boxShadow: `0 0 20px ${healthColor}40` }} />
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid rgba(51, 65, 85, 0.3)" }}>
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>Nulls Detectados</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "16px", fontWeight: "700", color: nullPct === 0 ? "#10b981" : "#f59e0b" }}>{nullPct.toFixed(1)}%</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>Status</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "16px", fontWeight: "700", color: healthColor }}>
                {health >= 90 ? "✓ Limpo" : health >= 70 ? "⚠ Revisar" : "✗ Problemas"}
              </p>
            </div>
          </div>
        </div>

        {/* Dataset Summary - Compact Info */}
        <div style={{ 
          backgroundColor: "linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.7) 100%)", 
          border: "1px solid #334155", 
          borderRadius: "16px", 
          padding: "28px", 
          display: "flex", 
          flexDirection: "column", 
          gap: "20px",
          backdropFilter: "blur(8px)"
        }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>📋 Summary do Dataset</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>Estrutura e composição dos dados</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              { icon: "📍", label: "Linhas", value: fmt.number(rowCount ?? 0), color: "#3b82f6" },
              { icon: "🏛️", label: "Colunas", value: String(colCount ?? 0), color: "#8b5cf6" },
              { icon: "📅", label: "Datas", value: String(dateCols.length), color: "#06b6d4" },
              { icon: "🔢", label: "Numéricas", value: String(numericCols.length), color: "#10b981" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "rgba(51, 65, 85, 0.2)", borderRadius: "12px", border: `1px solid ${color}40` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "16px" }}>{icon}</span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>{label}</span>
                </div>
                <span style={{ fontSize: "20px", fontWeight: "800", color }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(51, 65, 85, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🏷️</span>
              <div>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>Categorias</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "800", color: "#a78bfa" }}>{categoricalCols.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Type Breakdown */}
      <div>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#f1f5f9", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🔍</span> Tipos de Dados
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          {[
            { icon: "📅", label: "Data & Tempo", cols: dateCols, color: "#06b6d4", bgColor: "#06b6d440" },
            { icon: "🔢", label: "Numéricas", cols: numericCols, color: "#3b82f6", bgColor: "#3b82f640" },
            { icon: "🏷️", label: "Categorias", cols: categoricalCols, color: "#a78bfa", bgColor: "#a78bfa40" },
          ].map(({ icon, label, cols, color, bgColor }) => (
            <div key={label} style={{ 
              backgroundColor: "rgba(30, 41, 59, 0.5)", 
              border: `1px solid ${color}40`, 
              borderLeft: `4px solid ${color}`,
              borderRadius: "12px", 
              padding: "16px", 
              display: "flex", 
              flexDirection: "column", 
              gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>{icon}</span>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: color }}>{label}</p>
                </div>
                <span style={{ fontSize: "12px", fontWeight: "800", color, backgroundColor: bgColor, padding: "4px 8px", borderRadius: "6px" }}>{cols.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                {cols.length === 0 && (
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>— Nenhum detectado</p>
                )}
                {cols.slice(0, 6).map(c => (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 0" }}>
                    <span style={{ fontSize: "8px", color, opacity: 0.6 }}>●</span>
                    <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c}>{c}</p>
                  </div>
                ))}
                {cols.length > 6 && (
                  <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#64748b", fontWeight: "600" }}>+{cols.length - 6} mais</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Integrity Report */}
      <div style={{ 
        backgroundColor: "linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.7) 100%)",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
        backdropFilter: "blur(8px)"
      }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#f1f5f9", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🔐</span> Integridade de Dados
        </h3>
        
        {quality.filter(q => q.null_pct > 0).length === 0 ? (
          <div style={{ 
            backgroundColor: "#10b98120", 
            border: "1px solid #10b981", 
            borderRadius: "12px", 
            padding: "16px", 
            display: "flex", 
            alignItems: "center", 
            gap: "12px"
          }}>
            <span style={{ fontSize: "24px" }}>✓</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#10b981" }}>Nenhum valor nulo detectado</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#86efac" }}>Seus dados estão 100% completos</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {quality
              .filter(q => q.null_pct > 0)
              .sort((a, b) => b.null_pct - a.null_pct)
              .slice(0, 8)
              .map(q => {
                const nullColor = q.null_pct > 20 ? "#ef4444" : q.null_pct > 10 ? "#f59e0b" : "#eab308"
                return (
                  <div key={q.column} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#cbd5e1", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.column}>📌 {q.column}</span>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: nullColor }}>{q.null_pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "5px", backgroundColor: "rgba(51, 65, 85, 0.4)", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ height: "5px", backgroundColor: nullColor, opacity: 0.8, borderRadius: "999px", width: `${Math.min(q.null_pct, 100)}%`, transition: "all 0.3s ease" }} />
                    </div>
                  </div>
                )
              })}
            {quality.filter(q => q.null_pct > 0).length > 8 && (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b", textAlign: "center" }}>+{quality.filter(q => q.null_pct > 0).length - 8} colunas com valores nulos</p>
            )}
          </div>
        )}
      </div>

      {/* NF/Efetivo Analytics - if template is detected */}
      {sessionId && (
        <div style={{ marginTop: "20px" }}>
          <OverviewAnalytics sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}
