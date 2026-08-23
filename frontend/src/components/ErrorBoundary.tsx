import { Component, ReactNode, ErrorInfo } from "react";

/**
 * ErrorBoundary — Captura erros de renderização e exibe uma UI amigável.
 *
 * Props:
 *   children   — conteúdo normal da árvore React
 *   fallback   — (opcional) elemento React customizado a exibir em caso de erro
 */

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Erro capturado:", error, info.componentStack);
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: "16px",
          padding: "32px",
          textAlign: "center",
          color: "var(--text-muted, #6b7280)",
        }}
      >
        <div style={{ fontSize: "48px" }}>⚠️</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text, #111827)" }}>
          Algo deu errado
        </div>
        <div style={{ fontSize: "14px", maxWidth: "400px", lineHeight: 1.6 }}>
          Ocorreu um erro inesperado nesta página. Tente novamente ou recarregue o aplicativo.
        </div>
        {this.state.error?.message && (
          <code
            style={{
              fontSize: "12px",
              background: "var(--surface-2, #f3f4f6)",
              padding: "6px 12px",
              borderRadius: "6px",
              maxWidth: "480px",
              overflowWrap: "break-word",
              color: "var(--text-muted, #6b7280)",
            }}
          >
            {this.state.error.message}
          </code>
        )}
        <button
          onClick={this.handleReset}
          style={{
            marginTop: "8px",
            padding: "10px 24px",
            background: "var(--accent, #6366f1)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-sm, 6px)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
