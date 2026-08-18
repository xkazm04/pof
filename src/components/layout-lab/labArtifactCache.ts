'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { fetchArtifactsResult, fetchStepSummaryResult } from './labArtifactClient';
import type { Result } from '@/types/result';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepSummary } from './stepSummary';

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

/**
 * The BLOB-FREE half of the same cache: one entry per catalog holding only the verdict
 * projection of its rows ({@link StepSummary}). Same store discipline (dedup, stale-response
 * guard, error-as-a-state), same listener set and the SAME `version` signal — so a reader
 * that already subscribes to the cache picks up summary arrivals with no second subscription.
 *
 * It is a separate Map rather than a `summary:` key in `store` because the entries carry a
 * different payload type; folding them into one map would force every existing reader to
 * narrow. Invalidation/retry/reset drive BOTH maps from the same call sites below, so the two
 * halves can never hold contradictory truth about a catalog.
 */
export interface SummaryCacheEntry {
  loading: boolean;
  rows: StepSummary[];
  loaded: boolean;
  error: string | null;
}

const NO_ROWS: StepSummary[] = [];
const EMPTY_SUMMARY: SummaryCacheEntry = Object.freeze({ loading: false, rows: NO_ROWS, loaded: false, error: null });
const LOADING_SUMMARY: SummaryCacheEntry = Object.freeze({ loading: true, rows: NO_ROWS, loaded: false, error: null });

const summaryStore = new Map<string, SummaryCacheEntry>();
const summarySeq = new Map<string, number>();

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
 * Kick off (or reuse) the BLOB-FREE fetch for a catalog — the whole-project read path.
 * Mirrors {@link ensureArtifacts} exactly (no-op while loading/loaded/errored, stale-response
 * guard, a failure stored AS a failure so a dead server never reads as "nothing produced").
 */
export function ensureSummary(catalogId: string): void {
  const cur = summaryStore.get(catalogId);
  if (cur && (cur.loading || cur.loaded || cur.error)) return;
  const seq = (summarySeq.get(catalogId) ?? 0) + 1;
  summarySeq.set(catalogId, seq);
  summaryStore.set(catalogId, LOADING_SUMMARY);
  emit();
  fetchStepSummaryResult(catalogId).then((res) => {
    if (summarySeq.get(catalogId) !== seq) return; // superseded by an invalidation or a newer fetch
    summaryStore.set(catalogId, res.ok
      ? { loading: false, rows: res.data, loaded: true, error: null }
      : { loading: false, rows: NO_ROWS, loaded: false, error: res.error });
    emit();
  });
}

/**
 * Non-hook read of a catalog's summary entry. Pair with {@link useArtifactCacheVersion} —
 * the cross-catalog coach reads 36 catalogs inside ONE memo, which the rules of hooks forbid
 * doing with 36 subscriptions.
 */
export function getCachedSummary(catalogId: string): SummaryCacheEntry {
  return summaryStore.get(catalogId) ?? EMPTY_SUMMARY;
}

/** Drop a catalog's summary entry (bumping its sequence so an in-flight result is discarded). */
function dropSummary(catalogId: string): boolean {
  if (!summaryStore.has(catalogId)) return false;
  summarySeq.set(catalogId, (summarySeq.get(catalogId) ?? 0) + 1);
  summaryStore.delete(catalogId);
  return true;
}

/**
 * Explicit retry after a failed fetch: drop the stored error (and any cached data for
 * the key) and re-issue. Backs the "Retry" affordance every errored surface offers.
 *
 * It retries BOTH halves for the catalog. The coach's own "status unknown for N catalogs —
 * retry" control calls this with a bare `catalogId`, and after the coach moved to the
 * blob-free read that button would otherwise re-issue a fetch nobody is waiting on while
 * leaving the failure it is pointing at in place.
 */
export function retryArtifacts(catalogId: string, entityId?: string): void {
  const key = keyFor(catalogId, entityId);
  seqByKey.set(key, (seqByKey.get(key) ?? 0) + 1);
  store.delete(key);
  // Only RE-issue a summary that existed: a per-entity retry from the Baseline must not
  // conjure a whole-catalog summary fetch nobody is reading.
  const hadSummary = dropSummary(catalogId);
  emit();
  ensureArtifacts(catalogId, entityId);
  if (hadSummary) ensureSummary(catalogId);
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
  // A refresh has just PROVED the server moved, so the catalog's blob-free projection of the
  // same rows is stale by construction — drop it too, or the coach would keep ranking against
  // exactly the truth this refresh disproved.
  dropSummary(catalogId);
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
  // The summary is a projection of the very rows this invalidation says have moved, so it is
  // dropped with them — an entity-scoped produce stales the whole-catalog projection exactly
  // as it stales the whole-catalog artifact key above.
  if (dropSummary(catalogId)) changed = true;
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
  summaryStore.clear();
  summarySeq.clear();
  listeners.clear();
  flushScheduled = false;
  version = 0;
}
