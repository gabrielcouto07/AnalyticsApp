import { Component, type ReactNode } from "react"

interface Props {
  /** Muda de valor por página — remonta o boundary ao trocar de aba (limpa o erro). */
  pageKey: string
  pageLabel: string
  onBackToDashboard: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Fronteira de erro POR PÁGINA (route-level). Isola uma aba analítica: se ela
 * lançar durante o render, apenas a área de conteúdo mostra a recuperação —
 * a sidebar, o header e a sessão permanecem montados e navegáveis. Nunca
 * recorremos a window.location.reload().
 */
export class PageBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    // Ao navegar para outra aba, zera o erro (nova página, novo boundary).
    if (prev.pageKey !== this.props.pageKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[PageBoundary:${this.props.pageLabel}]`, error)
    }
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 text-center"
        style={{ minHeight: "50vh", padding: "32px" }}
      >
        <div style={{ fontSize: "40px" }}>⚠️</div>
        <div>
          <h2 className="m-0 text-lg font-bold text-text">
            Não foi possível exibir a página “{this.props.pageLabel}”.
          </h2>
          <p className="mt-2 mb-0 text-sm text-muted" style={{ maxWidth: "460px" }}>
            Ocorreu um erro ao renderizar esta aba. As demais páginas e sua sessão
            continuam disponíveis — você pode tentar novamente ou voltar ao painel.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={this.retry}
            className="px-4 py-2 rounded-lg border-none bg-primary text-white text-sm font-bold cursor-pointer"
          >
            Tentar novamente
          </button>
          <button
            onClick={this.props.onBackToDashboard}
            className="px-4 py-2 rounded-lg border border-border bg-transparent text-muted text-sm font-semibold cursor-pointer"
          >
            Voltar ao dashboard
          </button>
        </div>
        {import.meta.env.DEV && (
          <details className="text-left" style={{ maxWidth: "560px" }}>
            <summary className="cursor-pointer text-xs text-muted">Detalhes técnicos</summary>
            <pre className="text-[11px] text-danger" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    )
  }
}
