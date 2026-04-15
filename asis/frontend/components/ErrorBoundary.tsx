"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React ErrorBoundary — catches unhandled rendering errors in the component
 * tree so the rest of the UI stays functional.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log the error so it surfaces in observability tooling
    console.error("[ErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <div className="text-2xl font-semibold text-rose-400">Something went wrong</div>
          <p className="mt-2 text-sm text-slate-400">
            An unexpected error occurred while rendering this section.
          </p>
          {this.state.error?.message ? (
            <pre className="mt-4 max-w-full overflow-auto rounded bg-black/40 px-4 py-2 text-xs text-slate-300">
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            className="mt-6 rounded-xl bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-500"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
