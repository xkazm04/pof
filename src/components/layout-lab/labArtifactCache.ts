'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { fetchArtifacts } from './labArtifactClient';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * A small shared artifact-fetch cache for the /layout lab, keyed `catalogId` (a
 * whole-catalog fetch, for CatalogMatrix) or `catalogId|entityId` (one entity, for
 * Baseline). Both the rail and the matrix used to own independent fetch paths, so
 * rapid tree clicks issued a fetch storm and each surface reset to "everything
 * pending" mid-fetch. This module gives them ONE cache + ONE invalidation path:
 *
 * - `useCachedArtifacts` returns `{ arts, loading, loaded }` and triggers a fetch on
 *   first read of a key (dedup: concurrent readers of the same key share one fetch).
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
  /** True once at least one fetch has resolved — distinguishes "never loaded" from "empty". */
  loaded: boolean;
}

// Frozen shared snapshots for the two zero-data states, so `useSyncExternalStore`'s
// getSnapshot returns a STABLE reference (a fresh object each call would infinite-loop).
const EMPTY: ArtifactCacheEntry = Object.freeze({ loading: false, arts: [], loaded: false });
const LOADING: ArtifactCacheEntry = Object.freeze({ loading: true, arts: [], loaded: false });

const store = new Map<string, ArtifactCacheEntry>();
const seqByKey = new Map<string, number>(); // per-key request sequence (stale-response guard)
const listeners = new Set<() => void>();

function keyFor(catalogId: string, entityId?: string): string {
  return entityId ? `${catalogId}|${entityId}` : catalogId;
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * Kick off (or reuse) a fetch for a key. No-op when the key is already loading or
 * loaded — that dedup is what collapses the fetch storm on rapid navigation.
 */
export function ensureArtifacts(catalogId: string, entityId?: string): void {
  const key = keyFor(catalogId, entityId);
  const cur = store.get(key);
  if (cur && (cur.loading || cur.loaded)) return;
  const seq = (seqByKey.get(key) ?? 0) + 1;
  seqByKey.set(key, seq);
  store.set(key, LOADING);
  emit();
  fetchArtifacts(catalogId, entityId).then((arts) => {
    if (seqByKey.get(key) !== seq) return; // superseded by an invalidation or a newer fetch
    store.set(key, { loading: false, arts, loaded: true });
    emit();
  });
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
}
