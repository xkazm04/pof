'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';

/** `null` = loaded but no spec persisted yet; `undefined` = not yet loaded. */
type SpecSlot = EnrichedAbilitySpec | null;

interface AbilitySpecState {
  /** specByEntity['catalogId/entityId'] = EnrichedAbilitySpec | null */
  specByEntity: Record<string, SpecSlot>;

  /** Record the persisted spec (or its absence) for one entity, from /api/ability-spec. */
  loadSpec: (catalogId: string, entityId: string, spec: SpecSlot) => void;
  /** Optimistically set an edited spec (callers also POST /api/ability-spec). */
  setSpec: (catalogId: string, entityId: string, spec: EnrichedAbilitySpec) => void;
  /** undefined = never loaded; null = loaded-but-none; record = present. */
  getSpec: (catalogId: string, entityId: string) => SpecSlot | undefined;
}

export function specKey(catalogId: string, entityId: string): string {
  return `${catalogId}/${entityId}`;
}

/**
 * Per-entity enriched ability specs. The DB (`ability-spec-db.ts` via
 * /api/ability-spec) is the source of truth; this store is loaded on entity
 * open and updated optimistically on edit. No persist middleware — DB owns it,
 * mirroring baselineStore / pipelineStore / catalogStore.
 */
export const useAbilitySpecStore = create<AbilitySpecState>()((set, get) => ({
  specByEntity: {},

  loadSpec: (catalogId, entityId, spec) =>
    set((s) => ({
      specByEntity: { ...s.specByEntity, [specKey(catalogId, entityId)]: spec },
    })),

  setSpec: (catalogId, entityId, spec) =>
    set((s) => ({
      specByEntity: { ...s.specByEntity, [specKey(catalogId, entityId)]: spec },
    })),

  getSpec: (catalogId, entityId) => get().specByEntity[specKey(catalogId, entityId)],
}));

/** Reactive selector hook for one entity's spec slot (undefined = unloaded). */
export function useEntityAbilitySpec(catalogId: string, entityId: string): SpecSlot | undefined {
  return useAbilitySpecStore(useShallow((s) => s.specByEntity[specKey(catalogId, entityId)]));
}
