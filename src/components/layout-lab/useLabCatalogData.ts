'use client';

import { useMemo } from 'react';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';

export interface LabCatalog {
  catalogId: string;
  label: string;
  description: string;
  total: number;
  verified: number;
}

export interface LabGroup {
  category: string;
  catalogs: LabCatalog[];
}

/**
 * Shared data for every identity-lab variant: the registered catalogs grouped by
 * spreadsheet category, with real entity counts from the catalog store. Same source
 * the production hub + Live State use, so the prototypes show real data.
 */
export function useLabCatalogData(): LabGroup[] {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);

  return useMemo(() => {
    const byCat = new Map<string, LabCatalog[]>();
    for (const s of CATALOG_SECTIONS) {
      const entities = Object.values(entitiesByCatalog[s.catalogId] ?? {});
      const cat: LabCatalog = {
        catalogId: s.catalogId,
        label: s.label,
        description: s.description ?? '',
        total: entities.length,
        verified: entities.filter((e) => e.lifecycle === 'verified').length,
      };
      const arr = byCat.get(s.category ?? 'Other') ?? [];
      arr.push(cat);
      byCat.set(s.category ?? 'Other', arr);
    }
    return [...byCat.entries()].map(([category, catalogs]) => ({ category, catalogs }));
  }, [entitiesByCatalog]);
}
