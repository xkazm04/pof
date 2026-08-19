'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';

/**
 * Shared loader for `/api/feature-matrix/all-statuses` — the unfiltered
 * cross-module status table (`SELECT module_id, feature_name, status FROM
 * feature_matrix`, no WHERE). It is the single fetch path for that endpoint:
 * the NBA card, the Feature Matrix, the Constellation, the Implementation Plan,
 * the Unified Summary, the Dependency Graph, the Nexus view and the
 * Cross-Module dashboard all read through it. Several of those mount together
 * on the Evaluator module; each used to hand-roll its own fetch, running the
 * full-table scan once per consumer and building N separate `Map`s. This
 * module-level cache collapses that to ONE fetch + ONE `Map`: concurrent
 * callers await the same in-flight promise, and a resolved result is reused
 * within a short TTL (`UI_TIMEOUTS.featureStatusTtl`).
 *
 * The data is read-only between reviews (it only changes when a review /
 * auto-verify / seed PATCHes a status), so a brief TTL is safe; callers that
 * mutate statuses call {@link invalidateFeatureStatuses}, which drops the cache
 * AND refreshes every live subscriber — that is why routing all consumers here
 * matters: one invalidation is now seen by all of them, not just the caller.
 */

export interface FeatureStatusRow {
  moduleId: string;
  featureName: string;
  status: string;
}

export interface FeatureStatusesResult {
  /** Map keyed by `${moduleId}::${featureName}` → status. Empty until loaded (or on error). */
  statusMap: Map<string, string>;
  /** The same payload in row form, for consumers that group by feature rather than look up by key. */
  statuses: FeatureStatusRow[];
  isLoading: boolean;
  /** True once a load attempt has settled, regardless of success. */
  loaded: boolean;
  /** True if the most recent settled load failed (callers must not render failure as "no data"). */
  failed: boolean;
  /** Reason the most recent settled load failed (`null` when it succeeded / has not settled). */
  error: string | null;
  /** Drop the shared cache and refetch — for every subscriber, not just this one. */
  refresh: () => void;
}

const ENDPOINT = '/api/feature-matrix/all-statuses';
// Read-only between reviews; short enough that a fresh review is picked up
// quickly, long enough to dedupe the simultaneous mounts of one module view.
const TTL_MS = UI_TIMEOUTS.featureStatusTtl;

interface CacheEntry {
  map: Map<string, string>;
  rows: FeatureStatusRow[];
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

const EMPTY_MAP: Map<string, string> = new Map();
const EMPTY_ROWS: FeatureStatusRow[] = [];

function notify() {
  for (const cb of subscribers) cb();
}

/** The cache entry if it is still inside the TTL, else null. */
function freshCache(): CacheEntry | null {
  return cache && Date.now() - cache.fetchedAt < TTL_MS ? cache : null;
}

async function loadStatuses(gen: number): Promise<CacheEntry> {
  const result = await tryApiFetch<{ statuses: FeatureStatusRow[] }>(ENDPOINT);
  const map = new Map<string, string>();
  const rows = result.ok ? (result.data.statuses ?? []) : EMPTY_ROWS;
  if (result.ok) {
    for (const row of rows) map.set(`${row.moduleId}::${row.featureName}`, row.status);
  }
  return {
    map,
    rows,
    failed: !result.ok,
    error: result.ok ? null : result.error,
    fetchedAt: Date.now(),
    gen,
  };
}

/**
 * Resolve the shared status map: a fresh cache hit returns immediately, an
 * in-flight request of the CURRENT generation is shared, otherwise a single
 * fetch is started and its promise is shared by all concurrent callers.
 */
function getStatuses(): Promise<CacheEntry> {
  const hit = freshCache();
  if (hit) return Promise.resolve(hit);
  if (inflight && inflightGen === generation) return inflight;

  const gen = generation;
  const promise = loadStatuses(gen).then((entry) => {
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
 * Drop the cache so every consumer refetches — call after any mutation of
 * feature statuses (review, auto-verify, seed, PATCH). Live subscribers are
 * notified immediately, so an open Evaluator view refreshes without a remount.
 */
export function invalidateFeatureStatuses() {
  cache = null;
  inflight = null;
  generation++;
  notify();
}

/**
 * Subscribe to the shared all-statuses map. Every consumer of the endpoint
 * calls this, so the unfiltered table scan + Map build happen once per TTL
 * window and every consumer receives byte-for-byte identical data (the same
 * `Map` instance from the same cache entry).
 */
export function useFeatureStatuses(): FeatureStatusesResult {
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
      getStatuses().then((e) => {
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

  const refresh = useCallback(() => { invalidateFeatureStatuses(); }, []);

  return {
    statusMap: entry?.map ?? EMPTY_MAP,
    statuses: entry?.rows ?? EMPTY_ROWS,
    isLoading,
    loaded: entry !== null,
    failed: entry?.failed ?? false,
    error: entry?.error ?? null,
    refresh,
  };
}
