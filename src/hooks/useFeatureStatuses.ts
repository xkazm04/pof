'use client';

import { useState, useEffect } from 'react';
import { tryApiFetch } from '@/lib/api-utils';

/**
 * Shared loader for `/api/feature-matrix/all-statuses` — the unfiltered
 * cross-module status table (`SELECT module_id, feature_name, status FROM
 * feature_matrix`, no WHERE). Both the NBA card (useNBA) and the Feature Matrix
 * mount for the same module view and each used to fetch this endpoint
 * independently, running the full-table scan twice and building two separate
 * `Map`s. This module-level cache collapses that to ONE fetch + ONE `Map`:
 * concurrent callers await the same in-flight promise, and a resolved result is
 * reused within a short TTL. The data is read-only between reviews (it only
 * changes when a review/fix PATCHes a status), so a brief TTL is safe; callers
 * that mutate statuses (review/auto-verify) can `invalidateFeatureStatuses()`.
 */

interface FeatureStatusRow { moduleId: string; featureName: string; status: string }

export interface FeatureStatusesResult {
  /** Map keyed by `${moduleId}::${featureName}` → status. Empty until loaded (or on error). */
  statusMap: Map<string, string>;
  isLoading: boolean;
  /** True once a load attempt has settled, regardless of success. */
  loaded: boolean;
  /** True if the most recent settled load failed (callers fall back to no cross-module data). */
  failed: boolean;
}

const ENDPOINT = '/api/feature-matrix/all-statuses';
// Read-only between reviews; short enough that a fresh review is picked up
// quickly, long enough to dedupe the NBA + matrix mounts of one module view.
const TTL_MS = 5_000;

interface CacheEntry {
  map: Map<string, string>;
  failed: boolean;
  fetchedAt: number;
}

// Module-level singletons survive component remounts within the tab session.
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;
const subscribers = new Set<() => void>();

const EMPTY_MAP: Map<string, string> = new Map();

function notify() {
  for (const cb of subscribers) cb();
}

async function loadStatuses(): Promise<CacheEntry> {
  const result = await tryApiFetch<{ statuses: FeatureStatusRow[] }>(ENDPOINT);
  const map = new Map<string, string>();
  let failed = false;
  if (result.ok) {
    for (const row of result.data.statuses ?? []) {
      map.set(`${row.moduleId}::${row.featureName}`, row.status);
    }
  } else {
    failed = true;
  }
  return { map, failed, fetchedAt: Date.now() };
}

/**
 * Resolve the shared status map: a fresh cache hit returns immediately, an
 * in-flight request is shared, otherwise a single fetch is started and its
 * promise is shared by all concurrent callers.
 */
function getStatuses(): Promise<CacheEntry> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return Promise.resolve(cache);
  }
  if (inflight) return inflight;

  inflight = loadStatuses()
    .then((entry) => {
      cache = entry;
      return entry;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cache so the next consumer refetches (e.g. after a review/fix mutates statuses). */
export function invalidateFeatureStatuses() {
  cache = null;
  notify();
}

/**
 * Subscribe to the shared all-statuses map. Both useNBA and FeatureMatrix call
 * this, so the unfiltered table scan + Map build happen once per TTL window and
 * every consumer receives byte-for-byte identical data (the same `Map` instance
 * from the same cache entry).
 */
export function useFeatureStatuses(): FeatureStatusesResult {
  // Seed from a fresh cache so a second consumer mounting within the TTL renders
  // the data on its first paint without waiting for an effect tick.
  const fresh = cache && Date.now() - cache.fetchedAt < TTL_MS ? cache : null;
  const [entry, setEntry] = useState<CacheEntry | null>(fresh);
  const [isLoading, setIsLoading] = useState(!fresh);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      setIsLoading(true);
      getStatuses().then((e) => {
        if (cancelled) return;
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

  return {
    statusMap: entry?.map ?? EMPTY_MAP,
    isLoading,
    loaded: entry !== null,
    failed: entry?.failed ?? false,
  };
}
