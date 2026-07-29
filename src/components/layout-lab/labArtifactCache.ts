'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { fetchArtifactsResult } from './labArtifactClient';
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

// Frozen shared snapshots for the two zero-data states, so `useSyncExternalStore`'s
// getSnapshot returns a STABLE reference (a fresh object each call would infinite-loop).
const EMPTY: ArtifactCacheEntry = Object.freeze({ loading: false, arts: [], loaded: false, error: null });
const LOADING: ArtifactCacheEntry = Object.freeze({ loading: true, arts: [], loaded: false, error: null });

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

function emit(): void {
  version++;
  for (const l of listeners) l();
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
      : { loading: false, arts: [], loaded: false, error: res.error });
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
  version = 0;
}
