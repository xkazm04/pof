'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { fetchArtifactsResult } from './labArtifactClient';
import type { Result } from '@/types/result';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * A small shared artifact-fetch cache for the /layout lab, keyed `catalogId` (a
 * whole-catalog fetch, for CatalogMatrix) or `catalogId|entityId` (one entity, for
 * Baseline). Both the rail and the matrix used to own independent fetch paths, so
 * rapid tree clicks issued a fetch storm and each surface reset to "everything
 * pending" mid-fetch. This module gives them ONE cache + ONE invalidation path:
 *
 * - `useCachedArtifacts` returns `{ arts, loading, loaded, error }` and triggers a fetch
 *   on first read of a key (dedup: concurrent readers of the same key share one fetch).
 *   A FAILED fetch is stored as an explicit error entry — never as a successful empty
 *   load — so a dead server can't render as "nothing has been produced here".
 * - `retryArtifacts(catalogId[, entityId])` clears a stored error and refetches (an
 *   errored key never auto-retries, or a 500 would spin a fetch loop).
 * - `invalidateArtifacts(catalogId[, entityId])` drops the matching keys — called on
 *   produce (write-through) and drain — so the next read refetches server truth.
 * - `refreshArtifacts(catalogId[, entityId])` FORCES a refetch and returns the rows: the
 *   explicit, user-initiated "refresh from server". Nothing here polls — the modules are
 *   LRU-suspended, so a timer would fight `useSuspendableEffect`; freshness is asked for.
 * - Stale responses are discarded via a per-key request sequence, so an invalidation
 *   or key switch mid-flight can never clobber the cache with a superseded result.
 *
 * Hand-rolled on purpose (no SWR/react-query dependency), integrated with React via
 * `useSyncExternalStore` so every subscriber re-renders on cache changes.
 */

export interface ArtifactCacheEntry {
  /** A fetch for this key is in flight and no data has arrived yet. */
  loading: boolean;
  /** The server artifacts for the key ([] until the first fetch resolves). */
  arts: PipelineArtifact[];
  /** True once at least one fetch has SUCCEEDED — distinguishes "never loaded" from "empty". */
  loaded: boolean;
  /**
   * The reason the last fetch for this key failed, else `null`. The third state that
   * makes LOADING / EMPTY / ERROR distinguishable: an errored entry has `loaded:false`
   * and `arts:[]`, but its `[]` means "unknown", not "nothing produced".
   */
  error: string | null;
}

// ONE frozen empty artifact list shared by every zero-data entry (EMPTY / LOADING / error).
// Consumers that derive from `arts` can then memoize on its reference and skip a recompute
// across the EMPTY→LOADING flip, which carries no artifact news at all — that flip alone was
// one whole-fleet re-derivation per catalog on the homepage's first paint.
const NO_ARTS: PipelineArtifact[] = [];

// Frozen shared snapshots for the two zero-data states, so `useSyncExternalStore`'s
// getSnapshot returns a STABLE reference (a fresh object each call would infinite-loop).
const EMPTY: ArtifactCacheEntry = Object.freeze({ loading: false, arts: NO_ARTS, loaded: false, error: null });
const LOADING: ArtifactCacheEntry = Object.freeze({ loading: true, arts: NO_ARTS, loaded: false, error: null });

const store = new Map<string, ArtifactCacheEntry>();
const seqByKey = new Map<string, number>(); // per-key request sequence (stale-response guard)
const listeners = new Set<() => void>();

// Monotonic version bumped on every cache mutation. It is the stable snapshot value
// the cross-catalog coach aggregation subscribes to (via `useArtifactCacheVersion`),
// so a whole-project derivation can key its memo on "the cache changed" without each
// catalog needing its own `useCachedArtifacts` hook (which the rules of hooks forbid
// in a 33-catalog loop) — and it re-runs progressively as each catalog fetch resolves.
let version = 0;

function keyFor(catalogId: string, entityId?: string): string {
  return entityId ? `${catalogId}|${entityId}` : catalogId;
}

// Emissions are COALESCED onto a microtask. The homepage fans out one fetch per registered
// catalog, and each key emits at least twice (loading → resolved); notifying synchronously
// woke every subscriber ~2N times per paint. The store itself is still mutated
// synchronously, so any `getCachedArtifacts` read in the same tick sees the new truth — only
// the notification is batched, and it always lands before the next task.
let flushScheduled = false;

function flush(): void {
  flushScheduled = false;
  for (const l of listeners) l();
}

function emit(): void {
  version++;
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * Kick off (or reuse) a fetch for a key. No-op when the key is already loading, loaded
 * or ERRORED — the first two are the dedup that collapses the fetch storm on rapid
 * navigation; the error bail-out is what stops a failing server from spinning an
 * endless retry loop (every subscriber's effect re-fires on the new entry reference).
 * Use {@link retryArtifacts} for the explicit, operator-driven retry.
 */
export function ensureArtifacts(catalogId: string, entityId?: string): void {
  const key = keyFor(catalogId, entityId);
  const cur = store.get(key);
  if (cur && (cur.loading || cur.loaded || cur.error)) return;
  const seq = (seqByKey.get(key) ?? 0) + 1;
  seqByKey.set(key, seq);
  store.set(key, LOADING);
  emit();
  fetchArtifactsResult(catalogId, entityId).then((res) => {
    if (seqByKey.get(key) !== seq) return; // superseded by an invalidation or a newer fetch
    // A failure is stored AS a failure. Storing `{ arts: [], loaded: true }` here (the old
    // behaviour) was indistinguishable from a genuinely empty catalog, so every reader
    // rendered a dead server as "nothing has been produced here".
    store.set(key, res.ok
      ? { loading: false, arts: res.data, loaded: true, error: null }
      : { loading: false, arts: NO_ARTS, loaded: false, error: res.error });
    emit();
  });
}

/**
 * Explicit retry after a failed fetch: drop the stored error (and any cached data for
 * the key) and re-issue. Backs the "Retry" affordance every errored surface offers.
 */
export function retryArtifacts(catalogId: string, entityId?: string): void {
  const key = keyFor(catalogId, entityId);
  seqByKey.set(key, (seqByKey.get(key) ?? 0) + 1);
  store.delete(key);
  emit();
  ensureArtifacts(catalogId, entityId);
}

/**
 * FORCE a refetch for a key and hand the caller the result — the explicit,
 * user-initiated "refresh from server" path.
 *
 * It differs from {@link ensureArtifacts} (no-op when loaded/errored) and from
 * {@link invalidateArtifacts} (drops the entry and hopes a subscriber's effect refetches)
 * in the two ways a refresh needs: it always issues the request, and it RETURNS the rows,
 * so the caller can reconcile the local store against exactly the response it just stored
 * — no second fetch, and no race with whichever effect happens to re-`ensure` first.
 *
 * A per-entity refresh also drops the whole-catalog key, so the matrix and the coach
 * re-read that catalog rather than keeping a snapshot this refresh has just disproved.
 * Stale-response handling matches `ensureArtifacts`: a superseded result is returned to
 * the caller but never written to the cache.
 */
export async function refreshArtifacts(catalogId: string, entityId?: string): Promise<Result<PipelineArtifact[], string>> {
  const key = keyFor(catalogId, entityId);
  const seq = (seqByKey.get(key) ?? 0) + 1;
  seqByKey.set(key, seq);
  store.set(key, LOADING);
  emit();
  const res = await fetchArtifactsResult(catalogId, entityId);
  if (seqByKey.get(key) !== seq) return res; // superseded — never clobber newer truth
  store.set(key, res.ok
    ? { loading: false, arts: res.data, loaded: true, error: null }
    : { loading: false, arts: NO_ARTS, loaded: false, error: res.error });
  if (entityId && store.has(catalogId)) {
    seqByKey.set(catalogId, (seqByKey.get(catalogId) ?? 0) + 1);
    store.delete(catalogId);
  }
  emit();
  return res;
}

/**
 * Invalidate a catalog's cache (its whole-catalog key and every per-entity key), or
 * just one entity's when `entityId` is given. Bumps the request sequence so any
 * in-flight fetch's result is discarded, then drops the entry so the next read
 * refetches. Called on produce (write-through) and drain.
 */
export function invalidateArtifacts(catalogId: string, entityId?: string): void {
  let changed = false;
  for (const key of [...store.keys()]) {
    const matches = entityId
      ? key === keyFor(catalogId, entityId) || key === catalogId // an entity produce also stales the catalog-wide view
      : key === catalogId || key.startsWith(`${catalogId}|`);
    if (!matches) continue;
    seqByKey.set(key, (seqByKey.get(key) ?? 0) + 1);
    store.delete(key);
    changed = true;
  }
  if (changed) emit();
}

/**
 * Non-hook read of a key's current cache entry. For the cross-catalog coach, which
 * reads many catalogs' entries inside one memo rather than one hook per catalog.
 * Pair with {@link useArtifactCacheVersion} so the memo recomputes as fetches land.
 */
export function getCachedArtifacts(catalogId: string, entityId?: string): ArtifactCacheEntry {
  return store.get(keyFor(catalogId, entityId)) ?? EMPTY;
}

/**
 * Subscribe to the cache's monotonic version — bumps on every mutation (fetch
 * resolve, ensure, invalidate). Lets an aggregate reader recompute progressively
 * without a per-catalog hook. Returns 0 during SSR.
 */
export function useArtifactCacheVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** Subscribe a component to a key's cache entry; triggers a fetch on first read. */
export function useCachedArtifacts(catalogId: string | undefined, entityId?: string): ArtifactCacheEntry {
  const entry = useSyncExternalStore(
    subscribe,
    () => (catalogId ? store.get(keyFor(catalogId, entityId)) ?? EMPTY : EMPTY),
    () => EMPTY, // SSR: nothing loaded
  );
  // Re-ensure whenever the key changes OR the entry was dropped by an invalidation.
  // Depending on the entry REFERENCE (EMPTY/LOADING are stable frozen singletons, and a
  // ready entry is a stable object until the next change) re-fires the effect the moment
  // an invalidation resets the entry to EMPTY — even mid-load, where `loaded` never
  // flips. `ensureArtifacts` is a no-op while loading/loaded, so this can't loop.
  useEffect(() => {
    if (catalogId) ensureArtifacts(catalogId, entityId);
  }, [catalogId, entityId, entry]);
  return catalogId ? entry : EMPTY;
}

/** Test-only: clear all cache state between cases. */
export function _resetArtifactCache(): void {
  store.clear();
  seqByKey.clear();
  listeners.clear();
  flushScheduled = false;
  version = 0;
}
