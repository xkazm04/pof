'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { logger } from '@/lib/logger';
import { LAB_RETURN, resolveSurface } from '@/lib/shell/surfaces';

/**
 * The app's ONLY route-level error boundary. There is no `global-error.tsx` and no
 * per-route `error.tsx`, so in App Router this file catches throws on EVERY surface —
 * the lab shell (which IS the homepage: `page.tsx` → `NewHome` → `LayoutLab` →
 * `Baseline`), `/status`, `/3d`, `/experiment` and `/harness` alike.
 *
 * It used to be written as though the lab were the only one: it announced "The lab
 * shell crashed … the catalog tree, the pipeline rail" and reassured the user that
 * "your produced artifacts are on the server". On the 3D Studio that named a surface
 * the user was not on and guaranteed state that was not in play — the same lie class
 * the step crash boundaries were built to remove. So the subject is now DERIVED from
 * the pathname (`@/lib/shell/surfaces`), and a surface that cannot honestly promise
 * anything about state says nothing rather than borrowing the lab's sentence. An
 * unrecognised path gets copy that guesses nothing at all.
 *
 * A step that throws inside the work canvas is contained by {@link StepCrashBoundary}
 * (`@/components/layout-lab/StepCrashBoundary`) and costs the operator one panel. THIS
 * catches everything ABOVE that boundary — including the derivations that run inside
 * `useBaseline` before any component renders — which would otherwise blank the whole
 * application to a white screen with no message at all.
 *
 * It is deliberately loud and never auto-retries: a silent re-render loop would hide a
 * deterministic data fault instead of reporting it. Re-rendering and reloading are both
 * user acts, and the tests pin that.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const surface = resolveSurface(pathname);
  const { headline, body, stateClaim } = surface.crash;

  useEffect(() => {
    logger.error(`[app/error] ${surface.name} (${pathname ?? 'unknown path'}) crashed:`, error);
  }, [error, pathname, surface.name]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8" role="alert" style={{ ['--focus-accent' as string]: 'var(--setup)' }}>
      <div className="max-w-xl w-full">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-text mb-1">{headline}</h1>
          <p className="text-sm text-text-muted">{body}</p>
          {stateClaim && <p className="text-xs text-text-muted mt-2">{stateClaim}</p>}
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
          {/* A crash on a secondary surface can leave you with no route home; the lab
              always has one. Never shown ON the lab (it would point at itself). */}
          {!surface.isLab && (
            <a
              href={LAB_RETURN.href}
              aria-label={LAB_RETURN.ariaLabel}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-text-muted text-sm border border-border hover:bg-surface-hover transition-colors focus-ring"
            >
              {LAB_RETURN.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
