'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';

interface Props {
  children: ReactNode;
  /** Facet label, for the fallback message + log context. */
  facetLabel?: string;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary around a single rendered facet (ECW Phase 11-OBS). Once ECW is
 * the only shell (Phase 12), a facet that throws must not white-screen the whole
 * inspector — this catches the render error, logs it, and shows an inline
 * fallback so the rest of the entity inspector stays usable. Reset by remounting
 * (the tab strip keys it by facet id).
 */
export class FacetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // console.error is the sanctioned error path (logger has no .error).
    console.error(`Facet "${this.props.facetLabel ?? 'unknown'}" failed to render`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="px-4 py-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: SEVERITY_TOKENS.critical.color }} aria-hidden="true" />
          <div className="text-text-muted">
            <div className="text-text">This facet failed to render.</div>
            <div className="text-2xs font-mono text-text-muted/70 mt-0.5">{this.state.error.message}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
