'use client';

import { useMemo } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

export interface CatalogRosterRow {
  catalogId: string;
  label: string;
  total: number;
  verified: number;
  failingCount: number;
}

/**
 * Aggregates per-catalog statistics from `catalogStore` × `CATALOG_SECTIONS`.
 * Returns one row per registered catalog in registration order. Read-only.
 *
 * Implementation note: we select the raw `entitiesByCatalog` slice (stable
 * reference until the store updates) and derive the roster via `useMemo`.
 * Computing the rows inside a `useShallow` selector creates new row object
 * references every render and causes a getSnapshot-cache-invalid infinite
 * loop under React 19's strict snapshot checks (Zustand v5 gotcha).
 */
export function useCatalogRoster(): CatalogRosterRow[] {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);

  return useMemo(
    () =>
      CATALOG_SECTIONS.map((section) => {
        const entities = Object.values(entitiesByCatalog[section.catalogId] ?? {});
        const verified = entities.filter((e) => e.lifecycle === 'verified').length;
        const failingCount = entities.filter((e) => e.lastTestResult === 'fail').length;
        return {
          catalogId: section.catalogId,
          label: section.label,
          total: entities.length,
          verified,
          failingCount,
        };
      }),
    [entitiesByCatalog],
  );
}
