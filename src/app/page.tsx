'use client';

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NewAppShell } from '@/components/ecw/NewAppShell';
import { readShellPref } from '@/lib/ecw/shell-pref';

/**
 * Root page. ECW is the default shell; the legacy shell is reachable via the
 * ShellSwitcher (which sets `?legacy=1` + a stored preference). Both shells
 * coexist while the migration completes. `useSyncExternalStore(popstate)` lets
 * the switcher swap the shell live, with an SSR snapshot of 'ecw'.
 */
export default function Home() {
  const pref = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    readShellPref,
    () => 'ecw' as const,
  );

  return pref === 'legacy' ? <AppShell /> : <NewAppShell />;
}
