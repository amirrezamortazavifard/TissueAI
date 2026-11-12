import { Component, ReactNode } from "react";
import { Shield } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: "100%",
          height: "100%",
          background: "#1a1020",
          color: "rgba(255,255,255,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          fontFamily: "monospace",
          padding: "40px",
          position: "fixed",
          inset: 0,
          zIndex: 999999,
        }}>
          <Shield size={48} style={{ color: "#E57373" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0, color: "#E57373" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "14px", color: "#ff6b6b", maxWidth: "500px", textAlign: "center", lineHeight: 1.6, fontWeight: 600 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "rgba(91,168,245,0.15)",
              border: "1px solid rgba(91,168,245,0.3)",
              color: "#5BA8F5",
              padding: "10px 24px",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Reload App
          </button>
          <pre style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.5)",
            maxWidth: "700px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            marginTop: "16px",
            padding: "12px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            maxHeight: "300px",
            overflow: "auto",
          }}>
            {this.state.error?.stack}
            {"\n\nComponent Stack:\n"}
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
