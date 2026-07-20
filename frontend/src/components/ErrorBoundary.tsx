import { Component, type ErrorInfo, type ReactNode } from "react"
import { useSession } from "../store/session"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string | null
  when: string | null
}

/**
 * Fronteira de erro global (React error boundary).
 *
 * Qualquer exceção de renderização não tratada em qualquer página/componente é
 * capturada aqui — em vez de desmontar toda a árvore e deixar uma tela preta em
 * branco (era exatamente o sintoma do crash do Plotly). Mostra uma tela de
 * fallback em pt-BR com detalhe técnico recolhível e um caminho de recuperação
 * que NÃO expõe stack traces do backend ao usuário final.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, when: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, when: new Date().toISOString() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log seguro só em desenvolvimento — nunca vaza para produção
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info.componentStack)
    }
    this.setState({ componentStack: info.componentStack ?? null })
  }

  private handleReset = () => {
    // Volta à tela de upload sem recarregar a página; a sessão anterior
    // (se válida) permanece — só zeramos se o usuário pedir explicitamente.
    this.setState({ error: null, componentStack: null, when: null })
  }

  private handleClearAndReset = () => {
    useSession.getState().clear()
    this.setState({ error: null, componentStack: null, when: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const { error, componentStack, when } = this.state
    const code = error.name || "Error"

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          backgroundColor: "#0f172a",
          color: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "560px", width: "100%" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 12px" }}>
            Ocorreu um erro inesperado na interface
          </h1>
          <p style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 24px" }}>
            Nenhum dado anterior foi perdido. Você pode voltar e tentar novamente.
            Se o problema persistir, consulte os detalhes técnicos abaixo.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#4f8ef7",
                color: "#fff",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Voltar e tentar novamente
            </button>
            <button
              onClick={this.handleClearAndReset}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "transparent",
                color: "#cbd5e1",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Recomeçar do zero
            </button>
          </div>

          <details
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.6)",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "14px 16px",
            }}
          >
            <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
              Detalhes técnicos
            </summary>
            <dl style={{ margin: "12px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <dt style={{ fontWeight: 700, minWidth: "80px" }}>Código</dt>
                <dd style={{ margin: 0, color: "#f87171" }}>{code}</dd>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <dt style={{ fontWeight: 700, minWidth: "80px" }}>Momento</dt>
                <dd style={{ margin: 0 }}>{when}</dd>
              </div>
              <div style={{ marginTop: "8px" }}>
                <dt style={{ fontWeight: 700, marginBottom: "4px" }}>Mensagem</dt>
                <dd style={{ margin: 0 }}>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: "11px",
                      color: "#cbd5e1",
                      margin: 0,
                    }}
                  >
                    {error.message}
                    {import.meta.env.DEV && componentStack ? `\n${componentStack}` : ""}
                  </pre>
                </dd>
              </div>
            </dl>
          </details>
        </div>
      </div>
    )
  }
}
