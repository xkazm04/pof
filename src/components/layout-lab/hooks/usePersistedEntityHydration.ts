'use client';

import { useEffect } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useCatalogStore } from '@/stores/catalogStore';
import type { PersistedRow } from '@/lib/catalog/persistedHydration';

/** A row the merge can read: string ids and an entity object. */
function isPersistedRow(r: unknown): r is PersistedRow {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return typeof o.catalogId === 'string' && typeof o.entityId === 'string' && !!o.entity && typeof o.entity === 'object';
}

/**
 * Load every server-persisted catalog entity into the lab once, on mount.
 *
 * Before this, nothing read `catalog_entities` back: a persisted entity was resolvable by
 * every server gate and absent from the tree. That included other sessions' one-shot drafts
 * and every ingested reference entity (`source: 'ingest'`), which is what the `/diablo` loop's
 * human gate reviews. A failed fetch is logged and leaves the cache as it was — the tree then
 * shows what it showed before, never an emptied list.
 */
export function usePersistedEntityHydration(): void {
  const hydrate = useCatalogStore((s) => s.hydratePersisted);
  useEffect(() => {
    let cancelled = false;
    void tryApiFetch<{ entities: PersistedRow[] }>('/api/catalog-entities?all=1').then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        logger.warn(`catalog-entities hydration failed: ${res.error}`);
        return;
      }
      // A SUCCESS envelope can still carry the wrong shape (another server on the port, an older
      // API, a test double). Trusting it threw an unhandled rejection from the merge; the contract
      // above is "log and leave the cache as it was", so the shape is checked, not assumed.
      const rows = (res.data as { entities?: unknown } | null)?.entities;
      if (!Array.isArray(rows)) {
        logger.warn(`catalog-entities hydration: expected { entities: [] }, got ${JSON.stringify(res.data)?.slice(0, 120)} — cache left unchanged`);
        return;
      }
      // …and so is each ROW: one null / id-less record used to throw inside the merge, an
      // unhandled rejection that discarded every good row beside it.
      const valid = rows.filter(isPersistedRow);
      if (valid.length < rows.length) {
        logger.warn(`catalog-entities hydration: ${rows.length - valid.length} malformed row(s) dropped (need catalogId, entityId, entity)`);
      }
      const { shadowed } = hydrate(valid);
      if (shadowed.length) {
        logger.warn(`catalog-entities: ${shadowed.length} persisted row(s) collide with code seeds and are not shown: ${shadowed.join(', ')}`);
      }
    });
    return () => { cancelled = true; };
  }, [hydrate]);
}
