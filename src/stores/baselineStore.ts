'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { BalanceBaseline } from '@/lib/balance/baseline';

/** `null` = loaded but no baseline captured yet; `undefined` = not yet loaded. */
type BaselineSlot = BalanceBaseline | null;

interface BaselineState {
  /** baselineByEntity['catalogId/entityId'] = BalanceBaseline | null */
  baselineByEntity: Record<string, BaselineSlot>;

  /** Record the persisted baseline (or its absence) for one entity, from /api/balance-baseline. */
  loadBaseline: (catalogId: string, entityId: string, baseline: BaselineSlot) => void;
  /** Optimistically set a freshly-captured baseline (callers also POST /api/balance-baseline). */
  setBaseline: (catalogId: string, entityId: string, baseline: BalanceBaseline) => void;
  /** undefined = never loaded; null = loaded-but-none; record = present. */
  getBaseline: (catalogId: string, entityId: string) => BaselineSlot | undefined;
}

export function baselineKey(catalogId: string, entityId: string): string {
  return `${catalogId}/${entityId}`;
}

/**
 * Per-entity balance baseline snapshots. The DB (`baseline-db.ts` via
 * /api/balance-baseline) is the source of truth; this store is loaded on entity
 * open and updated optimistically on capture. No persist middleware — DB owns
 * it, mirroring the pipelineStore / catalogStore lifecycle convention.
 */
export const useBaselineStore = create<BaselineState>()((set, get) => ({
  baselineByEntity: {},

  loadBaseline: (catalogId, entityId, baseline) =>
    set((s) => ({
      baselineByEntity: { ...s.baselineByEntity, [baselineKey(catalogId, entityId)]: baseline },
    })),

  setBaseline: (catalogId, entityId, baseline) =>
    set((s) => ({
      baselineByEntity: { ...s.baselineByEntity, [baselineKey(catalogId, entityId)]: baseline },
    })),

  getBaseline: (catalogId, entityId) => get().baselineByEntity[baselineKey(catalogId, entityId)],
}));

/** Reactive selector hook for one entity's baseline slot (undefined = unloaded). */
export function useEntityBaseline(catalogId: string, entityId: string): BaselineSlot | undefined {
  return useBaselineStore(useShallow((s) => s.baselineByEntity[baselineKey(catalogId, entityId)]));
}
