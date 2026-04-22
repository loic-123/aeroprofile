import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback UI to identify which part of
   *  the app crashed (e.g. "Intervals detail view"). */
  label?: string;
  /** Optional callback that receives the error + info, typically used
   *  to log the crash to an external service. */
  onError?: (err: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Minimal React ErrorBoundary. Wraps a subtree so a thrown render-time
 * error doesn't blank the whole page (the "black screen" the user saw
 * when clicking a ride chip while another analysis was mid-flight).
 *
 * The fallback shows the error message and a "Retry" button that
 * resets the internal state — if the underlying condition is gone by
 * then (e.g. the half-loaded ride finished), the subtree re-renders
 * normally.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label ?? "", error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error);
      return (
        <div className="bg-panel border border-danger/40 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-danger shrink-0" size={20} aria-hidden />
          <div className="text-sm flex-1 min-w-0">
            <div className="font-semibold text-danger">
              Cet élément n'a pas pu s'afficher
              {this.props.label ? ` (${this.props.label})` : ""}.
            </div>
            <p className="mt-1 text-muted-strong text-xs font-mono break-all">
              {msg}
            </p>
            <p className="mt-2 text-muted text-xs">
              Le reste de la page reste utilisable. Tu peux recharger l'élément
              ou retourner en arrière.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 text-xs px-3 py-1 rounded border border-border hover:border-muted"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
