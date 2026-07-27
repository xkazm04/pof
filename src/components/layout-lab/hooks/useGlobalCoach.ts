'use client';

import { useEffect, useMemo } from 'react';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { ensureArtifacts, getCachedArtifacts, useArtifactCacheVersion } from '../labArtifactCache';
import { resolveCatalogSteps } from '../catalogManifest';
import { buildGlobalCoach, type CoachCandidate, type CoachCatalogInput } from '../globalCoachModel';
import { useLabPipelineStore } from '../labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/** How many next-step candidates the coach surfaces before "show all blockers". */
export const GLOBAL_COACH_TOP_N = 5;

/**
 * Cross-catalog next-step aggregation for the lab-level coach.
 *
 * Returns the FULL ranked candidate list (one candidate per entity with something
 * actionable). The top-N cut is a presentation decision made by `GlobalCoach`, so its
 * "show all blockers" expansion needs no second pass and no extra fetch — ranking a
 * few hundred already-derived candidates is free next to the derivation itself.
 *
 * It fetches every registered catalog's artifacts ONCE through the shared cache
 * (deduped, one whole-catalog GET per catalog — never per entity), and re-derives
 * the ranked candidate list progressively as each fetch lands (keyed on the cache
 * version). The whole aggregation is memoized, so it never re-fires on an unrelated
 * render. First paint is never blocked: the effect fires post-paint and the list
 * fills in as the fetches resolve.
 */
export function useGlobalCoach(topN = Number.POSITIVE_INFINITY): CoachCandidate[] {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const localByEntity = useLabPipelineStore((s) => s.byEntity);
  const version = useArtifactCacheVersion();

  const catalogIds = useMemo(() => CATALOG_SECTIONS.map((s) => s.catalogId), []);

  // Kick off one deduped whole-catalog fetch per catalog. `ensureArtifacts` is a
  // no-op once loading/loaded, so this can't storm on re-render.
  useEffect(() => {
    for (const c of catalogIds) ensureArtifacts(c);
  }, [catalogIds]);

  return useMemo(() => {
    void version; // the "cache changed" signal — reading it here makes the dep honest (getCachedArtifacts reads external state keyed on it)
    const inputs: CoachCatalogInput[] = [];
    for (const section of CATALOG_SECTIONS) {
      const entMap = entitiesByCatalog[section.catalogId];
      const entities = entMap
        ? Object.values(entMap).map((e) => ({ id: e.id, name: e.name, lifecycle: e.lifecycle, data: (e as { data?: unknown }).data }))
        : [];
      if (!entities.length) continue;

      const { arts } = getCachedArtifacts(section.catalogId);
      const serverByEntity = new Map<string, Map<string, PipelineArtifact>>();
      for (const a of arts) {
        const row = serverByEntity.get(a.entityId) ?? new Map<string, PipelineArtifact>();
        row.set(a.step, a);
        serverByEntity.set(a.entityId, row);
      }

      inputs.push({
        catalogId: section.catalogId,
        catalogLabel: section.label,
        steps: resolveCatalogSteps(section.catalogId),
        entities,
        serverByEntity,
        localByEntity,
      });
    }
    return buildGlobalCoach(inputs, topN);
    // `version` is the "cache changed" signal — recompute as each catalog's fetch resolves.
  }, [entitiesByCatalog, localByEntity, version, topN]);
}
