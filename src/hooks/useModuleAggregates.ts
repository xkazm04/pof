'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';

/**
 * Shared loader for `/api/feature-matrix/aggregate` — the per-module roll-up of
 * the feature matrix (`getAllModuleAggregates`: a GROUP BY over every
 * `feature_matrix` row plus the review-history join). It is the single fetch
 * path for that endpoint: the Aggregate Quality dashboard, the Cross-Module
 * Feature dashboard and the Unified Summary all read through it.
 *
 * This is the same treatment `useFeatureStatuses` gave `/all-statuses`, applied
 * to the endpoint with the same shape of problem. All three consumers mount on
 * the Evaluator module, so opening it ran the roll-up query once PER dashboard
 * and each built its own `moduleId → aggregate` Map; worse, the three could
 * disagree for a whole TTL window because nothing tied their refreshes
 * together. Concurrent callers now await one in-flight promise, a resolved
 * result is reused within `UI_TIMEOUTS.moduleAggregateTtl`, and every live
 * subscriber is refreshed by a single invalidation.
 *
 * An aggregate is DERIVED from the same rows `useFeatureStatuses` reads, so the
 * two caches must never be invalidated apart: {@link invalidateFeatureData} is
 * the composed invalidator every feature-matrix mutation should call.
 */

export interface ModuleAggregatesResult {
  /** The roll-up rows as returned. Empty until loaded (or on error). */
  aggregates: ModuleAggregate[];
  /** The same payload keyed by `moduleId` — built once, shared by every consumer. */
  byModule: Map<string, ModuleAggregate>;
  isLoading: boolean;
  /** True once a load attempt has settled, regardless of success. */
  loaded: boolean;
  /** True if the most recent settled load failed (callers must not render failure as "no data"). */
  failed: boolean;
  /** Reason the most recent settled load failed (`null` when it succeeded / has not settled). */
  error: string | null;
  /** Drop the shared caches and refetch — for every subscriber, not just this one. */
  refresh: () => void;
}

const ENDPOINT = '/api/feature-matrix/aggregate';
// Same reasoning as the statuses cache: the roll-up only moves when a review /
// auto-verify / PATCH writes a status, so a short TTL is enough to collapse the
// simultaneous mounts of one Evaluator view without serving stale numbers.
const TTL_MS = UI_TIMEOUTS.moduleAggregateTtl;

interface CacheEntry {
  rows: ModuleAggregate[];
  byModule: Map<string, ModuleAggregate>;
  failed: boolean;
  error: string | null;
  fetchedAt: number;
  /** Invalidation generation this entry was loaded in (see `generation`). */
  gen: number;
}

// Module-level singletons survive component remounts within the tab session.
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;
let inflightGen = -1;
/**
 * Bumped by every invalidation. A load started before an invalidation must not
 * populate the cache afterwards (it read the pre-mutation table), and a
 * subscriber must not apply its late result over a newer one — both are guarded
 * by comparing against this counter.
 */
let generation = 0;
const subscribers = new Set<() => void>();

const EMPTY_ROWS: ModuleAggregate[] = [];
const EMPTY_MAP: Map<string, ModuleAggregate> = new Map();

function notify() {
  for (const cb of subscribers) cb();
}

/** The cache entry if it is still inside the TTL, else null. */
function freshCache(): CacheEntry | null {
  return cache && Date.now() - cache.fetchedAt < TTL_MS ? cache : null;
}

async function loadAggregates(gen: number): Promise<CacheEntry> {
  const result = await tryApiFetch<{ modules: ModuleAggregate[] }>(ENDPOINT);
  const rows = result.ok ? (result.data.modules ?? []) : EMPTY_ROWS;
  const byModule = new Map<string, ModuleAggregate>();
  for (const row of rows) byModule.set(row.moduleId, row);
  return {
    rows,
    byModule,
    failed: !result.ok,
    error: result.ok ? null : result.error,
    fetchedAt: Date.now(),
    gen,
  };
}

/**
 * Resolve the shared aggregates: a fresh cache hit returns immediately, an
 * in-flight request of the CURRENT generation is shared, otherwise a single
 * fetch is started and its promise is shared by all concurrent callers.
 */
function getAggregates(): Promise<CacheEntry> {
  const hit = freshCache();
  if (hit) return Promise.resolve(hit);
  if (inflight && inflightGen === generation) return inflight;

  const gen = generation;
  const promise = loadAggregates(gen).then((entry) => {
    // A newer generation means the table changed under us: keep the result for
    // the awaiting callers (they gen-guard it) but never seat it as the cache.
    if (gen === generation) {
      cache = entry;
      inflight = null;
    }
    return entry;
  });
  inflight = promise;
  inflightGen = gen;
  return promise;
}

/**
 * Drop the aggregate cache so every consumer refetches. Prefer
 * {@link invalidateFeatureData} at mutation sites — an aggregate and a status
 * row are two projections of the same table, and invalidating one without the
 * other is exactly the disagreement this hook exists to remove.
 */
export function invalidateModuleAggregates() {
  cache = null;
  inflight = null;
  generation++;
  notify();
}

/**
 * Invalidate BOTH feature-matrix read caches — the status rows and the
 * per-module roll-up derived from them. This is the call every mutation of the
 * matrix (review, auto-verify, seed, PATCH) should make: dropping only one
 * leaves the Evaluator showing a roll-up that contradicts its own status cells.
 */
export function invalidateFeatureData() {
  invalidateFeatureStatuses();
  invalidateModuleAggregates();
}

/**
 * Subscribe to the shared module aggregates. Every consumer of the endpoint
 * calls this, so the roll-up query + Map build happen once per TTL window and
 * every dashboard renders byte-for-byte identical numbers (the same rows from
 * the same cache entry).
 */
export function useModuleAggregates(): ModuleAggregatesResult {
  // Seed from a fresh cache so a second consumer mounting within the TTL renders
  // the data on its first paint without waiting for an effect tick. The seed is a
  // LAZY initialiser: reading the clock during every render is impure
  // (react-hooks/purity) — it only ever mattered at mount.
  const [entry, setEntry] = useState<CacheEntry | null>(freshCache);
  const [isLoading, setIsLoading] = useState(entry === null);
  const appliedGen = useRef(entry ? entry.gen : -1);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      setIsLoading(true);
      getAggregates().then((e) => {
        // Ignore a late result from an older generation — an invalidation has
        // since fired and a newer load has already been applied.
        if (cancelled || e.gen < appliedGen.current) return;
        appliedGen.current = e.gen;
        setEntry(e);
        setIsLoading(false);
      });
    };

    subscribers.add(sync);
    sync();

    return () => {
      cancelled = true;
      subscribers.delete(sync);
    };
  }, []);

  // A user-driven refresh of a dashboard refreshes the whole derived set, not
  // just this endpoint — the two caches move together or they lie to each other.
  const refresh = useCallback(() => { invalidateFeatureData(); }, []);

  return {
    aggregates: entry?.rows ?? EMPTY_ROWS,
    byModule: entry?.byModule ?? EMPTY_MAP,
    isLoading,
    loaded: entry !== null,
    failed: entry?.failed ?? false,
    error: entry?.error ?? null,
    refresh,
  };
}
