'use client';

/**
 * THE whole-project artifact read for /status — one shared, deduped fetch per catalog,
 * reused across every tab.
 *
 * ── What it replaces ──────────────────────────────────────────────────────────
 * Each tab re-fetched the entire project from scratch through its own bare `useEffect`: the
 * DEFAULT landing tab (Capability) fanned out one `GET /api/pipeline-artifacts` per
 * registered catalog, and switching to Pipelines fanned out the identical 32 again — the
 * views are unmounted on tab change, so nothing survived to be reused, and switching back
 * paid a third time. Measured against the real `~/.pof/pof.db` (32 registered pipelines,
 * 816 artifacts): **7,828,924 bytes per tab mount**, of which /status reads five fields.
 *
 * ── What it does instead ─────────────────────────────────────────────────────
 * It layers on `labArtifactCache` — the lab's shared, deduped, stale-guarded artifact cache
 * — rather than forking a second one. That store is module-level, so it OUTLIVES the tab
 * unmount: a Capability→Pipelines→Capability walk costs 32 requests instead of 96, a tab
 * return costs zero, and produce/drain invalidation already flows through it. It is the same
 * cache `/layout` fills, so a catalog the lab already read is free here.
 *
 * ── Why NOT the blob-free summary (yet) ──────────────────────────────────────
 * `GET /api/pipeline-artifacts/summary` projects these same rows 40× smaller (195,928 B for
 * the same 32 catalogs, measured) and is the obvious next step — but it CANNOT feed this
 * surface today. The status model binds every judge verdict to the content it judged by
 * recomputing `stepContentHash(artifact.data)` (`statusModel.contentByEntity`,
 * `capabilityModel`), and the summary deliberately carries no `data`. Measured on a fixture:
 * a hash-bound current PASS derives `verified` / provenance `current` / lane readyPct **100**
 * from the full rows and `trusted` / `stale` / readyPct **0** from the projection — a silent
 * UNDERSTATEMENT of exactly the kind this dashboard exists to prevent. The fix is one model
 * change, not a view change: `StepSummary` ALREADY carries `contentHash`, computed by the
 * same `stepContentHash` on the server, so the model needs to take the row's hash instead of
 * recomputing it from a blob. Until it does, /status reads the full rows — sharing them is
 * the win that is available without moving a single grade.
 *
 * A failed read stays a failure, per catalog (`CatalogArtifacts.error`). Nothing here
 * retries on its own; `retryCatalog` is operator-driven.
 */

import { useEffect, useMemo } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import {
  ensureArtifacts,
  getCachedArtifacts,
  retryArtifacts,
  useArtifactCacheVersion,
} from '@/components/layout-lab/labArtifactCache';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/** One catalog's outcome. `error` non-null means UNKNOWN — never "nothing produced". */
export interface CatalogArtifacts {
  catalogId: string;
  /** The rows read for this catalog; `[]` when `error` is set, which means UNKNOWN. */
  rows: PipelineArtifact[];
  /** True only when a fetch actually SUCCEEDED — distinguishes empty from unknown. */
  loaded: boolean;
  error: string | null;
}

export interface StatusArtifactSource {
  /**
   * Every registered pipeline's rows, in registry order — `null` until each catalog has
   * SETTLED (loaded or errored). Settle-then-render keeps the map's grades identical to the
   * pre-cache behaviour: a lane must never paint before the verdicts that grade it.
   */
  catalogs: CatalogArtifacts[] | null;
  /** Operator-driven re-read of ONE catalog (the per-lane retry). */
  retryCatalog: (catalogId: string) => void;
  /** Operator-driven re-read of every catalog. */
  reload: () => void;
}

/** Stable empty row list for an UNKNOWN catalog, so a re-render can't churn dependents. */
const NO_ROWS: PipelineArtifact[] = [];

/**
 * Subscribe to the shared whole-project read. Safe to call from several tabs/views: the
 * cache dedupes concurrent readers of a key onto one request, and an already-loaded catalog
 * issues nothing at all.
 */
export function useStatusArtifacts(): StatusArtifactSource {
  const version = useArtifactCacheVersion();
  // The registry is populated by the side-effect import above, so the list is stable for the
  // life of the page — memoized so the derivation below can key on the cache version alone.
  const catalogIds = useMemo(() => allCatalogPipelines().map((p) => p.catalogId), []);

  // `ensureArtifacts` is a no-op while a key is loading, loaded OR errored, so re-running
  // this on every cache mutation cannot loop and an errored catalog is never auto-retried.
  useEffect(() => {
    for (const id of catalogIds) ensureArtifacts(id);
  }, [catalogIds, version]);

  const catalogs = useMemo(() => {
    // The "cache changed" signal — reading it here makes the dep honest, exactly as
    // `useGlobalCoach` does (`getCachedArtifacts` reads external state keyed on it).
    void version;
    const entries = catalogIds.map((catalogId) => ({ catalogId, entry: getCachedArtifacts(catalogId) }));
    if (entries.some(({ entry }) => !entry.loaded && !entry.error)) return null; // still settling
    return entries.map(({ catalogId, entry }) => ({
      catalogId,
      // An errored entry's `arts` is `[]` meaning UNKNOWN — never handed on as data.
      rows: entry.loaded ? entry.arts : NO_ROWS,
      loaded: entry.loaded,
      error: entry.error,
    }));
  }, [catalogIds, version]);

  return useMemo(
    () => ({
      catalogs,
      // `retryArtifacts` drops the stored error and re-issues exactly this catalog. It also
      // re-issues a blob-free summary only if one already existed — /status never creates
      // one, so this costs precisely one request.
      retryCatalog: (catalogId: string) => retryArtifacts(catalogId),
      reload: () => {
        for (const id of catalogIds) retryArtifacts(id);
      },
    }),
    [catalogs, catalogIds],
  );
}
