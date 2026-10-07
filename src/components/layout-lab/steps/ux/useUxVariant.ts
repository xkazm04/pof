'use client';

import { useSyncExternalStore } from 'react';

/**
 * Opt-in for a /layout UX PROTOTYPE. A variant renders only while the address carries
 * `?ux=<slug>` (repeat the param, or comma-separate, to stack several). The lab's address
 * writer keeps every param it does not own (`labUrl`), so the flag survives step, entity and
 * view moves; without it every variant is absent and the lab renders exactly as before.
 *
 * Server snapshot is `false`, so SSR and the hydration pass agree and the variant appears on
 * the first client commit. `popstate` re-reads it on Back/Forward.
 */
export function uxVariantsIn(search: string): string[] {
  return new URLSearchParams(search).getAll('ux')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function useUxVariant(slug: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => uxVariantsIn(window.location.search).includes(slug),
    () => false,
  );
}
