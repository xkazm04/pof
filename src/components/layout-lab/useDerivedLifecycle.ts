'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { LifecycleState } from '@/lib/catalog/types';

/** What the tree/header need per entity: the derived state + the evidence behind it. */
export interface DerivedLifecycleEntry {
  lifecycle: LifecycleState;
  /** One plain sentence naming the evidence — rendered as the dot's tooltip. */
  summary: string;
  /** Drained L3/L4 gates that pass. 0 means the state stands on shape/static checks. */
  gatePasses: number;
}

export type DerivedLifecycleMap = ReadonlyMap<string, DerivedLifecycleEntry>;

interface ViewRow {
  entityId: string;
  lifecycle: LifecycleState;
  evidence?: { summary?: string; gatePasses?: number };
}

/**
 * Derived lifecycle for every entity of a catalog, read from the server's
 * `GET /api/catalog/lifecycle` (which derives from `pipeline_artifacts` and never writes).
 *
 * The lab's entity list comes from the catalog SEED, where every `lifecycle` is the
 * hardcoded `'planned'` — so before this the tree painted `pending ○` on every entity in
 * the product regardless of what the pipeline had proven. This is display only: it cannot
 * move a verdict, and it cannot reach `verified` on its own (the server gates that on a
 * drained L3/L4 gate).
 *
 * A failed/absent fetch resolves to an EMPTY map, and callers fall back to the seed's
 * lifecycle — a missing derivation must never be rendered as a state of its own.
 */
export function useDerivedLifecycle(catalogId: string | null | undefined): DerivedLifecycleMap {
  const [map, setMap] = useState<DerivedLifecycleMap>(() => new Map());

  useEffect(() => {
    if (!catalogId) {
      setMap(new Map());
      return;
    }
    let live = true;
    void (async () => {
      const res = await tryApiFetch<ViewRow[]>(
        `/api/catalog/lifecycle?catalogId=${encodeURIComponent(catalogId)}`,
      );
      if (!live) return;
      if (!res.ok || !Array.isArray(res.data)) {
        setMap(new Map());
        return;
      }
      setMap(new Map(res.data.map((r) => [r.entityId, {
        lifecycle: r.lifecycle,
        summary: r.evidence?.summary ?? '',
        gatePasses: r.evidence?.gatePasses ?? 0,
      }] as const)));
    })();
    return () => { live = false; };
  }, [catalogId]);

  return map;
}
