import { useSession, type SourceMeta } from "../store/session"

const SOURCE_LABEL: Record<string, string> = {
  base_unificada: "Base Unificada",
  raw_reconstruction: "reconstruída a partir de Dados Saída, Dados Entrada e Dados Venda",
  flat_file: "arquivo único",
}

const LEVEL_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  error:   { bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)", color: "#fca5a5", icon: "⛔" },
  partial: { bg: "rgba(245,166,35,0.08)",  border: "rgba(245,166,35,0.3)",  color: "#fcd34d", icon: "⚠️" },
  info:    { bg: "rgba(79,142,247,0.08)",  border: "rgba(79,142,247,0.25)", color: "#93c5fd", icon: "ℹ️" },
}

const RANK: Record<string, number> = { error: 0, partial: 1, info: 2 }

/**
 * Área informativa de FONTE ANALÍTICA + avisos.
 * Deixa explícito de onde vieram os números (Base Unificada × reconstrução) e
 * distingue avisos informativos, de dado parcial e erros bloqueantes.
 */
export function SourceBanner() {
  const source = useSession(s => s.source) as SourceMeta | null
  if (!source || !source.fact_source) return null

  const label = SOURCE_LABEL[source.fact_source] ?? source.fact_source
  const warnings = [...(source.warnings ?? [])].sort(
    (a, b) => (RANK[a.level] ?? 9) - (RANK[b.level] ?? 9),
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 text-xs"
        style={{
          padding: "8px 12px",
          borderRadius: "10px",
          backgroundColor: source.fallback_used ? "rgba(245,166,35,0.08)" : "rgba(52,201,126,0.08)",
          border: `1px solid ${source.fallback_used ? "rgba(245,166,35,0.3)" : "rgba(52,201,126,0.3)"}`,
          color: source.fallback_used ? "#fcd34d" : "#86efac",
          width: "fit-content",
        }}
        title={source.fallback_used
          ? "A Base Unificada não pôde ser usada; a base analítica foi reconstruída das abas brutas."
          : "Fonte canônica preferida."}
      >
        <span style={{ fontWeight: 700 }}>Fonte analítica:</span>
        <span>{label}</span>
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {warnings.map((w, i) => {
            const st = LEVEL_STYLE[w.level] ?? LEVEL_STYLE.info
            return (
              <div
                key={i}
                role={w.level === "error" ? "alert" : undefined}
                className="flex items-start gap-2 text-xs"
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  backgroundColor: st.bg,
                  border: `1px solid ${st.border}`,
                  color: st.color,
                }}
              >
                <span aria-hidden>{st.icon}</span>
                <span style={{ lineHeight: 1.5 }}>{w.message}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
