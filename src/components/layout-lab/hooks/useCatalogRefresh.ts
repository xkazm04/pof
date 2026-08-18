'use client';

import { useCallback, useState } from 'react';
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

/** The last refresh result, stamped with the catalog it describes. */
interface Landed {
  catalogId: string;
  outcome: CatalogRefreshOutcome | null;
  error: string | null;
}

export function useCatalogRefresh(catalogId: string, entities: { id: string; name: string }[]): CatalogRefreshState {
  const [landed, setLanded] = useState<Landed | null>(null);
  const [refreshingFor, setRefreshingFor] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLanded(null);
    setRefreshingFor(catalogId);
    void refreshCatalogFromServer(catalogId, entities)
      .then((res) => setLanded(res.ok
        ? { catalogId, outcome: res.data, error: null }
        : { catalogId, outcome: null, error: res.error }))
      .finally(() => setRefreshingFor((cur) => (cur === catalogId ? null : cur)));
  }, [catalogId, entities]);

  const dismiss = useCallback(
    () => setLanded((l) => (l && l.catalogId === catalogId ? null : l)),
    [catalogId],
  );

  const mine = landed?.catalogId === catalogId ? landed : null;
  return {
    refresh,
    refreshing: refreshingFor === catalogId,
    error: mine?.error ?? null,
    outcome: mine?.outcome ?? null,
    dismiss,
  };
}
