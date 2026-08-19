'use client';

import { usePathname } from 'next/navigation';
import { Compass } from 'lucide-react';
import { LAB_RETURN, NAVIGABLE_SURFACES } from '@/lib/shell/surfaces';

/**
 * 404 for any URL no route claims.
 *
 * Until now the app had none, so a mistyped path ended at Next's stock "This page could
 * not be found" — a bare black page with **no route home**, from an app whose entire
 * shell lives one link away. This names the path that missed, and offers the same
 * return affordance (`aria-label="Back to the Blueprint layout lab"`) that `/status`,
 * `/3d` and `/experiment` use, plus the surfaces the lab actually lists.
 *
 * It lists exactly `NAVIGABLE_SURFACES` — the same source the lab header and `LabSearch`
 * read — so this page can never advertise a surface the shell itself hides (`/harness`
 * is deliberately unlisted).
 */
export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex items-center justify-center p-8" role="alert" style={{ ['--focus-accent' as string]: 'var(--setup)' }}>
      <div className="max-w-lg w-full">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-surface-hover border border-border flex items-center justify-center mb-4">
            <Compass className="w-6 h-6 text-text-muted" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-text mb-1">No page at this address</h1>
          <p className="text-sm text-text-muted">
            PoF has no route for{' '}
            <span className="font-mono text-text break-all">{pathname ?? 'this URL'}</span>. Nothing
            failed and nothing was changed — the address simply does not name one of its surfaces.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface/50 p-3 mb-4">
          <p className="text-xs text-text-muted mb-2">Surfaces the lab links to:</p>
          <ul className="space-y-1">
            {NAVIGABLE_SURFACES.map((s) => (
              <li key={s.route} className="text-xs">
                <a href={s.route} className="text-text font-mono underline underline-offset-2 focus-ring">
                  {s.route}
                </a>
                <span className="text-text-muted"> — {s.name}: {s.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-center">
          <a
            href={LAB_RETURN.href}
            aria-label={LAB_RETURN.ariaLabel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-hover text-text text-sm font-medium border border-border-bright hover:bg-border-bright transition-colors focus-ring"
          >
            {LAB_RETURN.label}
          </a>
        </div>
      </div>
    </div>
  );
}
