'use client';

import { useEffect } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useCatalogStore } from '@/stores/catalogStore';
import type { PersistedRow } from '@/lib/catalog/persistedHydration';

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
      const { shadowed } = hydrate(res.data.entities);
      if (shadowed.length) {
        logger.warn(`catalog-entities: ${shadowed.length} persisted row(s) collide with code seeds and are not shown: ${shadowed.join(', ')}`);
      }
    });
    return () => { cancelled = true; };
  }, [hydrate]);
}
