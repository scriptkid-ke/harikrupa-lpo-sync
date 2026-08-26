import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors anywhere below it and shows a readable
 * message instead of a blank white page. Does NOT catch errors thrown at
 * module-import time (e.g. a bad createClient() call) — src/lib/supabase.ts
 * is written to never throw there; this boundary covers everything after.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error rendering the app:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper p-6">
          <div className="max-w-lg w-full card p-8">
            <h1 className="font-display text-xl font-semibold text-ink mb-2">Something went wrong</h1>
            <p className="text-sm text-ink-soft leading-relaxed mb-4">
              The app hit an unexpected error while rendering. The detail below is only for debugging —
              open the browser console for the full stack trace.
            </p>
            <pre className="text-xs bg-surface-sunken rounded p-3 overflow-auto text-status-rejected whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              className="btn-secondary mt-4"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
