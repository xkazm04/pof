'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Route-level error boundary for the root page — the `/layout` lab shell (which IS the
 * homepage: `page.tsx` → `NewHome` → `LayoutLab` → `Baseline`).
 *
 * A step that throws inside the work canvas is contained by
 * {@link StepCrashBoundary} (`@/components/layout-lab/StepCrashBoundary`) and costs the
 * operator one panel. THIS catches everything ABOVE that boundary — the catalog tree, the
 * pipeline rail, the header, the search index, and the derivations that run inside
 * `useBaseline` before any component renders — which would otherwise blank the whole
 * application to a white screen with no message at all.
 *
 * It is deliberately loud and never auto-retries: a silent re-render loop would hide a
 * deterministic data fault instead of reporting it.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('[app/error] the lab shell crashed:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8" role="alert" style={{ ['--focus-accent' as string]: 'var(--setup)' }}>
      <div className="max-w-xl w-full">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-text mb-1">The lab shell crashed</h1>
          <p className="text-sm text-text-muted">
            Something above the step canvas threw while rendering — the catalog tree, the pipeline
            rail, the header, or the data they derive from. A crash inside a single step is contained
            to that panel; this one was not, so the page could not be drawn.
          </p>
          <p className="text-xs text-text-muted mt-2">
            Nothing was written or deleted. Your produced artifacts are on the server and in this
            browser exactly as they were.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface/50 p-3 mb-4">
          <p className="text-xs text-red-400 font-mono break-all">{error.name}: {error.message}</p>
          {error.digest && (
            <p className="text-xs text-text-muted font-mono mt-2">digest: {error.digest}</p>
          )}
          {error.stack && (
            <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed mt-2">
              {error.stack.split('\n').slice(1, 8).map((l) => l.trim()).join('\n')}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-hover text-text text-sm font-medium border border-border-bright hover:bg-border-bright transition-colors focus-ring"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try rendering again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-text-muted text-sm border border-border hover:bg-surface-hover transition-colors focus-ring"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reload the page
          </button>
        </div>
      </div>
    </div>
  );
}
