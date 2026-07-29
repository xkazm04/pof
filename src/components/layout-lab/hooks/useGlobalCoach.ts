'use client';

// The step list a catalog derives against comes from its registered `StepSpec` pipeline.
// Importing the registry HERE (not just in CatalogMatrix) makes that resolution
// deterministic before the first derivation, which is what lets the per-catalog cache
// below hold a resolved step list without any chance of pinning a pre-registry fallback.
import '@/lib/catalog/pipelines/registry.generated';
import { useEffect, useMemo } from 'react';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { ensureArtifacts, getCachedArtifacts, useArtifactCacheVersion } from '../labArtifactCache';
import { resolveCatalogSteps } from '../catalogManifest';
import { buildCatalogCandidates, groupVerdictsByCatalog, rankCoachCandidates, type CoachCandidate } from '../globalCoachModel';
import { useLabPipelineStore } from '../labPipelineStore';
import { useAllJudgeVerdicts } from './useStepJudgeVerdicts';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

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
export interface GlobalCoachResult {
  /** The full ranked candidate list (the top-N cut is the component's decision). */
  candidates: CoachCandidate[];
  /**
   * At least one catalog's artifacts are still unread (never fetched, or in flight).
   * TRUE on first paint — so the coach can reserve its row and show a loading state
   * instead of popping in later and shoving the canvas down.
   */
  loading: boolean;
  /**
   * Catalogs whose artifact fetch FAILED. They contribute NO candidates: with no server
   * truth every step reads `unproduced`, so coaching "start this" could send the operator
   * to re-produce over work that exists. The coach names the gap instead of hiding it.
   */
  failedCatalogs: { catalogId: string; label: string; error: string }[];
}

/** Stable empty slice so a verdict-free catalog keeps a constant dependency reference. */
const EMPTY_VERDICTS: JudgeVerdict[] = [];

/** One catalog's memoized candidate list plus the exact inputs it was derived from. */
interface CatalogCacheEntry {
  deps: unknown[];
  candidates: CoachCandidate[];
}

/**
 * Per-catalog derivation cache, keyed `catalogId` → (deps by reference, candidates).
 *
 * Module-scoped rather than per-hook: it is a PURE deps→value memo (identical references in,
 * identical candidates out), so sharing it across instances is correct by construction and
 * costs nothing — while a `useRef` holder would be a ref read during render, which the
 * `react-hooks/refs` rule rightly forbids. Entries for catalogs that stop contributing are
 * pruned on every pass, so it can never outgrow the fleet.
 */
const catalogCandidateCache = new Map<string, CatalogCacheEntry>();

/** Test-only: forget every memoized catalog derivation. */
export function _resetGlobalCoachCache(): void {
  catalogCandidateCache.clear();
}

/** Shallow reference comparison of two dependency lists. */
function sameDeps(a: unknown[] | undefined, b: unknown[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function useGlobalCoach(topN = Number.POSITIVE_INFINITY): GlobalCoachResult {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const localByEntity = useLabPipelineStore((s) => s.byEntity);
  const version = useArtifactCacheVersion();
  // Cross-catalog judge verdicts (ONE unscoped cached read) so a coach candidate speaks the
  // same acceptance truth as the rail, the matrix and the step banner.
  const verdicts = useAllJudgeVerdicts();

  const catalogIds = useMemo(() => CATALOG_SECTIONS.map((s) => s.catalogId), []);

  // Kick off one deduped whole-catalog fetch per catalog. `ensureArtifacts` is a
  // no-op once loading/loaded, so this can't storm on re-render.
  useEffect(() => {
    for (const c of catalogIds) ensureArtifacts(c);
  }, [catalogIds]);

  // Verdicts grouped ONCE per verdict-list identity, so each catalog's slice keeps a
  // stable reference across renders (it is one of the per-catalog cache's dependencies).
  const verdictsByCatalog = useMemo(() => groupVerdictsByCatalog(verdicts), [verdicts]);

  // Deriving all 30+ catalogs on every cache emission was the homepage's dominant
  // first-paint cost: one fetch per catalog, each emitting as it settles, each emission
  // re-walking EVERY entity of EVERY catalog. Through `catalogCandidateCache` a catalog is
  // re-derived only when its OWN inputs change by reference — so a produce (or a fetch
  // landing) in one catalog leaves the other 30 untouched.
  return useMemo(() => {
    void version; // the "cache changed" signal — reading it here makes the dep honest (getCachedArtifacts reads external state keyed on it)
    const cache = catalogCandidateCache;
    const candidates: CoachCandidate[] = [];
    const failedCatalogs: GlobalCoachResult['failedCatalogs'] = [];
    // Unsettled = neither loaded nor errored: the pre-fetch state on first paint AND
    // every in-flight fetch. Counted over ALL sections (not just those with entities)
    // so an unhydrated catalog store still reads as "still loading", never as "clear".
    const loading = CATALOG_SECTIONS.some((s) => {
      const e = getCachedArtifacts(s.catalogId);
      return !e.loaded && !e.error;
    });
    const live = new Set<string>();
    for (const section of CATALOG_SECTIONS) {
      const entMap = entitiesByCatalog[section.catalogId];
      if (!entMap || Object.keys(entMap).length === 0) continue;

      const { arts, error } = getCachedArtifacts(section.catalogId);
      if (error) {
        // A failed fetch is NOT an empty catalog — skip it rather than emit a bogus
        // "nothing has run here" candidate for every one of its entities.
        failedCatalogs.push({ catalogId: section.catalogId, label: section.label, error });
        continue;
      }
      live.add(section.catalogId);
      const catalogVerdicts = verdictsByCatalog.get(section.catalogId) ?? EMPTY_VERDICTS;
      // Everything the derivation reads, by reference. `arts` (not the cache ENTRY) is the
      // artifact dependency on purpose: the entry object changes on the `loading` flip while
      // the artifacts it exposes are the same empty list, and `loading` is a chrome concern
      // the candidates do not depend on. `localByEntity` is keyed by entity, so only this
      // catalog's entity rows matter — a produce elsewhere must not invalidate this catalog.
      const deps: unknown[] = [entMap, arts, catalogVerdicts];
      for (const id of Object.keys(entMap)) deps.push(localByEntity[id]);

      const hit = cache.get(section.catalogId);
      if (hit && sameDeps(hit.deps, deps)) {
        candidates.push(...hit.candidates);
        continue;
      }

      const entities = Object.values(entMap).map((e) => ({ id: e.id, name: e.name, lifecycle: e.lifecycle, data: (e as { data?: unknown }).data }));
      const serverByEntity = new Map<string, Map<string, PipelineArtifact>>();
      for (const a of arts) {
        const row = serverByEntity.get(a.entityId) ?? new Map<string, PipelineArtifact>();
        row.set(a.step, a);
        serverByEntity.set(a.entityId, row);
      }
      const fresh = buildCatalogCandidates({
        catalogId: section.catalogId,
        catalogLabel: section.label,
        steps: resolveCatalogSteps(section.catalogId),
        entities,
        serverByEntity,
        localByEntity,
      }, catalogVerdicts);
      cache.set(section.catalogId, { deps, candidates: fresh });
      candidates.push(...fresh);
    }
    // Drop entries for catalogs that no longer contribute (emptied, or now errored) so the
    // cache can't outgrow the fleet or serve a candidate list for a catalog we skipped.
    for (const key of [...cache.keys()]) if (!live.has(key)) cache.delete(key);

    // Union of three round-10 directions: the coach reads judge verdicts through the ONE
    // acceptance derivation (`verdicts`); reports catalogs whose fetch FAILED so a dead
    // server is never coached as "nothing has run here"; and reports `loading` so the bar
    // reserves its row instead of popping in and shoving the canvas down.
    // Ranking is a stable sort over the candidates in catalog/entity order — exactly the
    // list `buildGlobalCoach` would have assembled in one pass.
    return { candidates: rankCoachCandidates(candidates, topN), loading, failedCatalogs };
    // `version` is the "cache changed" signal — recompute as each catalog's fetch resolves.
  }, [entitiesByCatalog, localByEntity, version, topN, verdictsByCatalog]);
}
