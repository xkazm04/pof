'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCatalogChanges, type CatalogChanges } from '../labCatalogChanges';
import { useLastVisit } from './useLastVisit';

/**
 * The changed-since digest for one catalog, computed when that catalog is OPENED.
 *
 * Not a poll and not a notification system: lab modules are LRU-suspended, so a timer would
 * fight `useSuspendableEffect`. It reads once per (catalog, baseline) and stops.
 *
 * Four honest states, and they are genuinely different things:
 *  - `no-baseline` — this catalog has never been opened on this machine. That is NOT
 *    "everything changed"; there is simply nothing to compare against yet.
 *  - `loading` — the read is in flight.
 *  - `error` — the read FAILED. Nothing may be concluded about what moved.
 *  - `ready` — the digest, which may legitimately be empty ("nothing moved since …").
 */
export type CatalogChangesState =
  | { kind: 'no-baseline' }
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'ready'; changes: CatalogChanges };

/** A landed result, stamped so another catalog's digest can never be shown as this one's. */
interface Landed {
  catalogId: string;
  since: string;
  state: CatalogChangesState;
}

export interface CatalogChangesResult {
  state: CatalogChangesState;
  /** Re-issue the read after a failure (the error banner's Retry). */
  retry: () => void;
}

export function useCatalogChanges(catalogId: string): CatalogChangesResult {
  const { since, recorded } = useLastVisit(catalogId);
  const [landed, setLanded] = useState<Landed | null>(null);
  // Bumped by `retry`, so a failed read can be re-issued without inventing a second fetch path.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!since) return; // no baseline (or the visit is not recorded yet) — nothing to ask
    let alive = true;
    void fetchCatalogChanges(catalogId, since).then((res) => {
      if (!alive) return;
      setLanded({ catalogId, since, state: res.ok ? { kind: 'ready', changes: res.data } : { kind: 'error', error: res.error } });
    });
    return () => { alive = false; };
  }, [catalogId, since, attempt]);

  const retry = useCallback(() => { setLanded(null); setAttempt((a) => a + 1); }, []);

  const state: CatalogChangesState = !recorded
    ? { kind: 'loading' }
    : !since
      ? { kind: 'no-baseline' }
      : (landed && landed.catalogId === catalogId && landed.since === since ? landed.state : { kind: 'loading' });
  return { state, retry };
}
