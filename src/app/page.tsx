'use client';

import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NewAppShell } from '@/components/ecw/NewAppShell';

function getEcwFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ecw') === '1';
}

/**
 * Root page. Picks between the new ECW shell (entity-centric workspace,
 * Phases 1-11) and the legacy AppShell based on the `?ecw=1` URL parameter.
 *
 * `useSyncExternalStore` reads the URL safely under React 19 strict-mode
 * rules and subscribes to popstate so back/forward swaps the shell live.
 */
export default function Home() {
  const useEcw = useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    getEcwFlag,
    () => false,
  );

  return useEcw ? <NewAppShell /> : <AppShell />;
}
