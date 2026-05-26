'use client';

import { useMemo } from 'react';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { labPipelineSteps } from './labPipelines';
import type { LifecycleState } from '@/lib/catalog/types';

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

export interface LabEntity {
  id: string;
  name: string;
  lifecycle: LifecycleState;
  data: unknown;
}

export interface LabDetail {
  catalog: LabCatalog;
  entities: LabEntity[];
  steps: string[];
}

/** Per-catalog detail data for a variant's second screen: entities (the "spell
 *  selection") + the fine pipeline step list. `null` when no catalog is selected.
 *  Draft entities (one-shot staged) are merged alongside seeded entities. */
export function useLabDetail(catalogId: string | null): LabDetail | null {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const draftEntitiesByCatalog = useCatalogStore((s) => s.draftEntitiesByCatalog);

  return useMemo(() => {
    if (!catalogId) return null;
    const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId);
    if (!section) return null;
    const seeded = Object.values(entitiesByCatalog[catalogId] ?? {});
    const drafts = Object.values(draftEntitiesByCatalog[catalogId] ?? {});
    const all = [...seeded, ...drafts];
    return {
      catalog: {
        catalogId, label: section.label, description: section.description ?? '',
        total: all.length, verified: all.filter((e) => e.lifecycle === 'verified').length,
      },
      entities: all.map((e) => ({
        id: e.id, name: e.name, lifecycle: e.lifecycle, data: (e as { data?: unknown }).data,
      })),
      steps: labPipelineSteps(catalogId),
    };
  }, [catalogId, entitiesByCatalog, draftEntitiesByCatalog]);
}
