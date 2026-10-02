'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import { verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Read the persisted judge verdicts so every lab surface can apply the same judge →
 * acceptance bridge the headless path applies (`resolveStepAcceptance`).
 *
 * Cheap by construction: ONE `/api/judge-verdicts?catalogId=…` read per catalog (or one
 * unscoped read for the cross-catalog coach), held in a keyed external store shared by every
 * step of that catalog and by /status (`statusVerdictSource`). Readers subscribe through
 * `useSyncExternalStore`, like `labArtifactCache`.
 *
 * ── Stale-while-revalidate, never an empty expiry ──────────────────────────────
 * A key is in one of three zones: MISS (no read ever succeeded — the lab hooks serve `[]`, no
 * overlay, never a fabricated verdict), FRESH (a successful read younger than
 * {@link JUDGE_VERDICT_CACHE_TTL_MS}, not invalidated) or STALE (older, or invalidated). A
 * stale read keeps SERVING its rows — marked `stale` — and issues ONE deduped revalidation;
 * when it lands every subscriber re-renders. Expiry used to delete the entry, so the first
 * render past the TTL served `[]` and nothing refetched: since the judge bridge only ever
 * down-grades, a vanished FAIL painted the step greener than the truth.
 * {@link invalidateJudgeVerdicts} (after any `judge_verdicts` write) marks entries stale, retires
 * their in-flight read (its answer may predate the write) and notifies: readers refetch at once.
 *
 * ── A failed read is not cached as an answer ─────────────────────────────────
 * A failure keeps the last successful rows (if any) and records the error beside them; it is
 * never stored as `[]`. {@link readAllJudgeVerdicts} is the `Result`-keeping read for surfaces
 * that must say so (/status). A failed revalidation backs off for one TTL (or until the next
 * invalidation), so a dead endpoint cannot spin a fetch loop.
 */

/** How long a fetched verdict list is FRESH before a reader revalidates it. Not a UI timing
 *  value (nothing animates on it) — a data-cache lifetime, like `BUILD_PARSE_CACHE_MAX`. */
export const JUDGE_VERDICT_CACHE_TTL_MS = 60_000;

/** Cache key for the unscoped (all-catalogs) read the global coach needs. */
const ALL_KEY = '*';

const EMPTY: JudgeVerdict[] = [];
type VerdictRead = Result<JudgeVerdict[], string>;

/** One key's held state. Immutable — every change swaps the object, which IS the snapshot. */
interface Entry {
  rows: JudgeVerdict[] | undefined; // the last SUCCESSFUL read — kept through expiry/invalidate/failure
  at: number; // when `rows` landed
  stale: boolean; // invalidated, or seen past the TTL by a reader, since `rows` landed
  error?: string; failedAt?: number; // the latest read failed (back-off clock); cleared on success
}

const MISS: Entry = Object.freeze({ rows: undefined, at: 0, stale: false });
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<VerdictRead>>();
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }
function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

function isFresh(e: Entry, now: number): boolean {
  return e.rows !== undefined && !e.stale && now - e.at <= JUDGE_VERDICT_CACHE_TTL_MS;
}
/** Should a mounted reader fetch? Not fresh, and not inside a failure's back-off window. */
function isDue(e: Entry, now: number): boolean {
  if (isFresh(e, now)) return false;
  return e.failedAt === undefined || now - e.failedAt > JUDGE_VERDICT_CACHE_TTL_MS;
}

/** Mark cached verdicts stale (all, or one catalog — which also stales the unscoped view),
 *  retire their in-flight reads and notify, so mounted readers revalidate now. Held rows stay
 *  served until the new read lands. Call after any write to `judge_verdicts`. */
export function invalidateJudgeVerdicts(catalogId?: string): void {
  const keys = catalogId ? [catalogId, ALL_KEY] : [...new Set([...cache.keys(), ...inflight.keys()])];
  let changed = false;
  for (const key of keys) {
    const e = cache.get(key);
    if (!e && !inflight.has(key)) continue;
    inflight.delete(key);
    cache.set(key, { ...(e ?? MISS), stale: true, failedAt: undefined });
    changed = true;
  }
  if (changed) emit();
}

/** A reader's post-render check (effects may read the clock; render may not): an entry seen
 *  past its TTL turns STALE (notifying every reader), then one deduped revalidation runs. */
function revalidateIfDue(key: string): void {
  const e = cache.get(key) ?? MISS;
  const now = Date.now();
  if (e.rows !== undefined && !e.stale && !isFresh(e, now)) {
    cache.set(key, { ...e, stale: true });
    emit();
  }
  if (isDue(cache.get(key) ?? MISS, now)) void loadVerdicts(key);
}

/** Test seam: drop EVERYTHING (rows included) so the next read is a miss. */
export function clearJudgeVerdictCache(): void {
  cache.clear();
  inflight.clear();
  emit();
}

function loadVerdicts(key: string): Promise<VerdictRead> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const url = key === ALL_KEY
    ? '/api/judge-verdicts'
    : `/api/judge-verdicts?catalogId=${encodeURIComponent(key)}`;
  const p = tryApiFetch<JudgeVerdict[]>(url).then((r): VerdictRead => {
    // An invalidation while this was in flight retired it: its answer may predate the write,
    // so it must not land over the entry the post-invalidation read will fetch.
    if (inflight.get(key) !== p) return r;
    inflight.delete(key);
    const prev = cache.get(key) ?? MISS;
    cache.set(key, r.ok
      ? { rows: r.data, at: Date.now(), stale: false }
      : { ...prev, error: r.error, failedAt: Date.now() });
    emit();
    return r;
  });
  inflight.set(key, p);
  return p;
}

/**
 * The whole-project verdict read, KEEPING its failure — for imperative callers that must say
 * when they could not read. A fresh entry resolves without a request; anything else (stale,
 * miss, failed) awaits a real read, deduped with every concurrent reader.
 */
export function readAllJudgeVerdicts(): Promise<VerdictRead> {
  const e = cache.get(ALL_KEY) ?? MISS;
  return isFresh(e, Date.now()) && e.rows ? Promise.resolve({ ok: true, data: e.rows }) : loadVerdicts(ALL_KEY);
}

/** The FRESH cached whole-project verdicts, or `undefined` (never read, stale or failed). */
export function peekAllJudgeVerdicts(): JudgeVerdict[] | undefined {
  const e = cache.get(ALL_KEY) ?? MISS;
  return isFresh(e, Date.now()) ? e.rows : undefined;
}

/** What a reader holds for one key. */
export interface JudgeVerdictState {
  /** The held verdicts — `[]` only while no read has ever succeeded. */
  rows: JudgeVerdict[];
  /** A read has succeeded (so `rows` is a real answer, perhaps stale). */
  loaded: boolean;
  /** `rows` are past the TTL or invalidated: served while a revalidation runs. */
  stale: boolean;
  /** The latest read failed; `rows` (if `loaded`) are the last truth before it. */
  error: string | undefined;
}

/** The shared subscriber: serves the held rows for `key`, revalidating (deduped) when due. */
function useVerdictState(key: string | undefined): JudgeVerdictState {
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? cache.get(key) ?? MISS : MISS),
    () => MISS, // SSR: nothing loaded
  );
  // Every commit re-checks the clock: expiry has no event of its own, so the first render past
  // the TTL is what notices it. Cheap (a map read); dedupe + back-off make it loop-proof.
  useEffect(() => { if (key) revalidateIfDue(key); });
  return useMemo(() => ({
    rows: entry.rows ?? EMPTY,
    loaded: entry.rows !== undefined,
    stale: entry.rows === undefined || entry.stale,
    error: entry.error,
  }), [entry]);
}

/** One catalog's verdicts with their freshness — for a surface that marks stale/failed reads. */
export function useCatalogJudgeVerdictState(catalogId: string | undefined): JudgeVerdictState {
  return useVerdictState(catalogId);
}

/** Every verdict across every catalog with its freshness — /status reads this. */
export function useAllJudgeVerdictState(): JudgeVerdictState {
  return useVerdictState(ALL_KEY);
}

/** Every verdict for a catalog — the input the rail/matrix/coach derivations need to bridge
 *  each of an entity's steps without one fetch per step. */
export function useCatalogJudgeVerdicts(catalogId: string | undefined): JudgeVerdict[] {
  return useVerdictState(catalogId).rows;
}

/** Every verdict across every catalog — for the cross-catalog global coach. */
export function useAllJudgeVerdicts(): JudgeVerdict[] {
  return useVerdictState(ALL_KEY).rows;
}

export function useStepJudgeVerdicts(catalogId: string | undefined, entityId: string, step: string): JudgeVerdict[] {
  const rows = useVerdictState(catalogId).rows;
  // Memoized so the acceptance memo downstream stays referentially stable between renders.
  return useMemo(() => verdictsForStep(rows, entityId, step), [rows, entityId, step]);
}
