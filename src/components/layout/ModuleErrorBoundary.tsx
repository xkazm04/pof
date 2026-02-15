'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useErrorDiagnosticsStore } from '@/stores/errorDiagnosticsStore';

interface Props {
  children: ReactNode;
  moduleName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.moduleName} crashed:`, error, info);
    useErrorDiagnosticsStore.getState().logError(this.props.moduleName, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  handleCopyError = () => {
    const { error } = this.state;
    if (!error) return;
    const text = `Module: ${this.props.moduleName}\nError: ${error.message}\n\nStack:\n${error.stack ?? 'N/A'}`;
    navigator.clipboard.writeText(text);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, showDetails } = this.state;
    const { moduleName } = this.props;

    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-1">
              Something went wrong
            </h3>
            <p className="text-sm text-text-muted">
              <span className="font-mono text-red-400">{moduleName}</span> encountered an error and couldn&apos;t render.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-hover text-text text-sm font-medium border border-border-bright hover:bg-border-bright transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={this.handleCopyError}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-text-muted text-sm border border-border hover:bg-surface-hover transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>

          {/* Error details toggle */}
          <div className="rounded-lg border border-border bg-surface/50">
            <button
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text transition-colors"
            >
              <span>Error details</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showDetails && error && (
              <div className="px-3 pb-3 border-t border-border">
                <p className="text-xs text-red-400 font-mono mt-2 mb-2 break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                    {error.stack
                      .split('\n')
                      .slice(1, 8)
                      .map((l) => l.trim())
                      .join('\n')}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
