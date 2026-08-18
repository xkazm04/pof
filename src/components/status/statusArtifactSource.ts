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
 * ── The blob-free read ───────────────────────────────────────────────────────
 * It reads `GET /api/pipeline-artifacts/summary` — the SAME rows, projected to their verdict
 * fields (status, tier, reason, write time, content hash) with the produce bodies left on the
 * server: **195,928 B for the same 32 catalogs, against 7,828,924 B of full rows — 40× less**.
 *
 * That was blocked until the model stopped needing `data`. It bound every judge verdict to the
 * content it judged by RE-hashing `stepContentHash(artifact.data)`, so a projection made a
 * hash-bound CURRENT pass compare against the hash of `{}` and read `stale` — measured on a
 * fixture: `verified` / `current` / lane readyPct 100 from full rows vs `trusted` / `stale` /
 * readyPct 0 from the projection, a silent UNDERSTATEMENT of exactly the kind this dashboard
 * exists to prevent. The model now TAKES the binding the row carries
 * (`statusModel.judgedContentOfRow`, fed by `summaryToVerdictRow`), which is the same
 * `stepContentHash` value computed server-side by `toStepSummary` — one function, both sides.
 * Equivalence is pinned on a fixture covering a hash-bound current PASS, a stale verdict and an
 * unhashable legacy one (`src/__tests__/lib/status/statusRowContentHash.test.ts`).
 *
 * A row that carries NO binding still degrades to NOT-proven (it condemns, it never elevates),
 * so the projection can only ever be more conservative than the blob, never more optimistic.
 *
 * A failed read stays a failure, per catalog (`CatalogArtifacts.error`). Nothing here
 * retries on its own; `retryCatalog` is operator-driven.
 */

import { useEffect, useMemo } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import {
  ensureSummary,
  getCachedSummary,
  invalidateArtifacts,
  useArtifactCacheVersion,
} from '@/components/layout-lab/labArtifactCache';
import { summaryToVerdictRow } from '@/components/layout-lab/stepSummary';
import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';

/** One catalog's outcome. `error` non-null means UNKNOWN — never "nothing produced". */
export interface CatalogArtifacts {
  catalogId: string;
  /** The rows read for this catalog — VERDICT-shaped, no produce blobs (see above);
   *  `[]` when `error` is set, which means UNKNOWN. */
  rows: ArtifactVerdictRow[];
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
const NO_ROWS: ArtifactVerdictRow[] = [];

/**
 * Operator-driven re-read of ONE catalog: drop the stored entry (error included) and re-issue
 * the blob-free fetch. Deliberately NOT `retryArtifacts`, which also re-issues the FULL
 * per-catalog read — the 7.4 MB this surface exists not to pay. `invalidateArtifacts` drops
 * both halves of the shared cache, so the lab re-reads its blobs lazily if it ever needs them.
 */
function retry(catalogId: string): void {
  invalidateArtifacts(catalogId);
  ensureSummary(catalogId);
}

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

  // `ensureSummary` is a no-op while a key is loading, loaded OR errored, so re-running
  // this on every cache mutation cannot loop and an errored catalog is never auto-retried.
  useEffect(() => {
    for (const id of catalogIds) ensureSummary(id);
  }, [catalogIds, version]);

  const catalogs = useMemo(() => {
    // The "cache changed" signal — reading it here makes the dep honest, exactly as
    // `useGlobalCoach` does (`getCachedSummary` reads external state keyed on it).
    void version;
    const entries = catalogIds.map((catalogId) => ({ catalogId, entry: getCachedSummary(catalogId) }));
    if (entries.some(({ entry }) => !entry.loaded && !entry.error)) return null; // still settling
    return entries.map(({ catalogId, entry }) => ({
      catalogId,
      // An errored entry's `rows` is `[]` meaning UNKNOWN — never handed on as data.
      // `catalogId` is re-attached here because the wire shape omits it (see summaryToVerdictRow).
      rows: entry.loaded ? entry.rows.map((r) => summaryToVerdictRow(catalogId, r)) : NO_ROWS,
      loaded: entry.loaded,
      error: entry.error,
    }));
  }, [catalogIds, version]);

  return useMemo(
    () => ({
      catalogs,
      retryCatalog: retry,
      reload: () => {
        for (const id of catalogIds) retry(id);
      },
    }),
    [catalogs, catalogIds],
  );
}
