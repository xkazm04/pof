'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { readShellPref, writeShellPref } from '@/lib/ecw/shell-pref';

/**
 * Header toggle between the ECW shell (the default) and the legacy shell.
 * Mounted in both headers (EcwTopBar + legacy TopBar). Switching writes the
 * stored preference and toggles `?legacy=1`, then dispatches popstate so
 * page.tsx's `useSyncExternalStore` swaps the shell live (no reload).
 */
export function ShellSwitcher() {
  const pref = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    readShellPref,
    () => 'ecw' as const,
  );
  const isLegacy = pref === 'legacy';

  const switchTo = useCallback((legacy: boolean) => {
    writeShellPref(legacy ? 'legacy' : 'ecw');
    const url = new URL(window.location.href);
    if (legacy) url.searchParams.set('legacy', '1');
    else url.searchParams.delete('legacy');
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
        onClick={() => switchTo(true)}
        aria-pressed={isLegacy}
        className={`focus-ring px-2 py-1 transition-colors ${
          isLegacy ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
        }`}
      >
        Legacy
      </button>
      <button
        onClick={() => switchTo(false)}
        aria-pressed={!isLegacy}
        className={`focus-ring px-2 py-1 transition-colors ${isLegacy ? 'text-text-muted hover:text-text' : 'bg-surface'}`}
        style={!isLegacy ? { color: ACCENT_EMERALD } : undefined}
      >
        New
      </button>
    </div>
  );
}
