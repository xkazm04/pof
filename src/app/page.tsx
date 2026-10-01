'use client';

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NewHome } from '@/components/layout-lab/NewHome';
import { readShellPref } from '@/lib/ecw/shell-pref';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';

/**
 * Root page. The New variant is the catalog-pipeline lab (/layout). The legacy
 * shell is reachable via the "Legacy shell" button in the lab top bar (which sets
 * a stored preference). `useSyncExternalStore(popstate)` lets the switcher swap
 * the shell live, with an SSR snapshot of 'ecw'. The leave guard lives HERE, above the
 * gate, because neither shell outlives the other (`useLeaveGuard`).
 */
export default function Home() {
  useLeaveGuard();
  const pref = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    readShellPref,
    () => 'ecw' as const,
  );

  return pref === 'legacy' ? <AppShell /> : <NewHome />;
}
