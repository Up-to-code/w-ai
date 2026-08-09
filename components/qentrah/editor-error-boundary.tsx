"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; documentKey: string };
type State = { error: Error | null; diagnostic: string | null };

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null, diagnostic: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, diagnostic: error.message || "Malformed page document" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({
      diagnostic: `${error.message}\n${info.componentStack ?? ""}`.trim(),
    });
  }

  componentDidUpdate(previous: Props) {
    if (previous.documentKey !== this.props.documentKey && this.state.error) {
      this.setState({ error: null, diagnostic: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[70vh] place-items-center bg-w-canvas p-8">
        <div className="w-full max-w-lg border border-border bg-card p-6">
          <AlertTriangle className="mb-5 size-5 text-destructive" />
          <h2 className="text-lg font-semibold">Canvas could not be loaded</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your saved document is intact. Reload the editor or copy the diagnostic
            below when asking for support.
          </p>
          <pre className="mt-5 max-h-40 overflow-auto bg-muted p-3 text-xs">
            {this.state.diagnostic}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null, diagnostic: null })}
            className="mt-5 inline-flex h-9 items-center gap-2 bg-foreground px-4 text-sm font-medium text-background"
          >
            <RotateCcw className="size-3.5" /> Try canvas again
          </button>
        </div>
      </div>
    );
  }
}
