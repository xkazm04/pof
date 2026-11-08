'use client';

import { useCallback, useRef, useState } from 'react';
import { refreshCatalogFromServer, type CatalogRefreshOutcome } from '../labCatalogRefresh';

/**
 * State for the Matrix's catalog-wide "refresh from server" — the same shape the per-entity
 * refresh keeps in `useBaseline` (in-flight flag · error · outcome), so both surfaces report
 * a reconciliation the same way.
 *
 * The result is STAMPED with the catalog it came from and read back through that stamp, so
 * another catalog's outcome can never be shown as this one's — including a response that
 * lands after the operator has already switched boards. That is a derivation, not a reset
 * effect: nothing here has to fire a render to forget the previous catalog.
 */
export interface CatalogRefreshState {
  refresh: () => void;
  refreshing: boolean;
  /** The GET failed — nothing was reconciled. */
  error: string | null;
  /** What the last refresh did for THIS catalog, or null when none has run. */
  outcome: CatalogRefreshOutcome | null;
  dismiss: () => void;
}

/** The last refresh result for one catalog. */
interface Landed {
  outcome: CatalogRefreshOutcome | null;
  error: string | null;
}

export function useCatalogRefresh(catalogId: string, entities: { id: string; name: string }[]): CatalogRefreshState {
  // Keyed BY CATALOG, one slot each: a single shared slot let whichever of two in-flight
  // refreshes (A, switch boards, B) landed last overwrite the other's report.
  const [landed, setLanded] = useState<Record<string, Landed>>({});
  // catalogId -> the attempt token of its latest refresh (latest-wins). Written only in the
  // callback, before the request leaves, so an older answer landing after a newer one is inert.
  const latest = useRef(new Map<string, number>());
  const [inFlight, setInFlight] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    const token = (latest.current.get(catalogId) ?? 0) + 1;
    latest.current.set(catalogId, token);
    setLanded((m) => { const { [catalogId]: _drop, ...rest } = m; void _drop; return rest; });
    setInFlight((m) => ({ ...m, [catalogId]: token }));
    void refreshCatalogFromServer(catalogId, entities)
      .then((res) => {
        if (latest.current.get(catalogId) !== token) return; // superseded — a newer refresh owns the slot
        setLanded((m) => ({ ...m, [catalogId]: res.ok ? { outcome: res.data, error: null } : { outcome: null, error: res.error } }));
      })
      .finally(() => setInFlight((m) => {
        if (m[catalogId] !== token) return m;
        const { [catalogId]: _done, ...rest } = m; void _done; return rest;
      }));
  }, [catalogId, entities]);

  const dismiss = useCallback(
    () => setLanded((m) => { if (!(catalogId in m)) return m; const { [catalogId]: _drop, ...rest } = m; void _drop; return rest; }),
    [catalogId],
  );

  const mine = landed[catalogId] ?? null;
  return {
    refresh,
    refreshing: catalogId in inFlight,
    error: mine?.error ?? null,
    outcome: mine?.outcome ?? null,
    dismiss,
  };
}
