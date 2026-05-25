'use client';

import { useSyncExternalStore, useCallback } from 'react';

function readEcwFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ecw') === '1';
}

/**
 * Header toggle between the legacy shell (`/`) and the new ECW shell
 * (`/?ecw=1`). Mounted in BOTH headers so the operator can flip either way
 * without typing the URL. Legacy is NOT descoped — this is a visible control
 * over the existing `?ecw` gate that `page.tsx` reads. Full legacy removal is
 * still Phase 12.
 *
 * Switching uses `history.pushState` + a dispatched `popstate` so `page.tsx`'s
 * `useSyncExternalStore(popstate)` swaps the shell with no full reload.
 */
export function ShellSwitcher() {
  const isEcw = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    readEcwFlag,
    () => false,
  );

  const switchTo = useCallback((ecw: boolean) => {
    const url = new URL(window.location.href);
    if (ecw) url.searchParams.set('ecw', '1');
    else url.searchParams.delete('ecw');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div
      role="group"
      aria-label="Shell switcher"
      className="flex items-center rounded-md border border-border/60 overflow-hidden text-2xs font-mono"
    >
      <button
        onClick={() => switchTo(false)}
        aria-pressed={!isEcw}
        className={`focus-ring px-2 py-1 transition-colors ${
          !isEcw ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
        }`}
      >
        Legacy
      </button>
      <button
        onClick={() => switchTo(true)}
        aria-pressed={isEcw}
        className={`focus-ring px-2 py-1 transition-colors ${
          isEcw ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-text-muted hover:text-text'
        }`}
      >
        New
      </button>
    </div>
  );
}
