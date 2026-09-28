'use client';

import { useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import { verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Read the persisted judge verdicts so every lab surface can apply the same judge →
 * acceptance bridge the headless path applies (`resolveStepAcceptance`).
 *
 * Cheap by construction: ONE `/api/judge-verdicts?catalogId=…` read per catalog (or one
 * unscoped read for the cross-catalog coach), cached and shared by every step of that
 * catalog. Non-throwing — the lab hooks below serve a failed/absent read as `[]`, i.e. no
 * overlay, never a fabricated verdict.
 *
 * ── Cache invalidation ─────────────────────────────────────────────────────────
 * The cache used to be permanent at module scope with a test-only clear, so a verdict
 * written by the judge fleet mid-session could never reach the screen — the lab showed a
 * stale acceptance for the rest of the page's life. Entries now carry a fetch timestamp and
 * expire after {@link JUDGE_VERDICT_CACHE_TTL_MS}; {@link invalidateJudgeVerdicts} drops them
 * on demand (e.g. after a judge write) without waiting for the TTL.
 *
 * ── A failed read is not cached ───────────────────────────────────────────────
 * Only a SUCCESSFUL read enters the cache. A failure used to be stored as `[]` for the full
 * TTL, so every reader for the next minute saw "no verdicts" — and a surface that grades with
 * verdicts then drops a condemning judge FAIL and paints the cell greener than the truth.
 * {@link readAllJudgeVerdicts} is the `Result`-keeping read for such surfaces (/status, via
 * `statusVerdictSource`): the failure comes back as `{ ok: false }`, never as an empty list.
 * The lab hooks keep their `[]` contract; a failed fetch simply does not re-arm them, so a
 * dead endpoint cannot spin a fetch loop.
 */

/** How long a fetched verdict list is served from cache before it is refetched. Not a UI
 *  timing value (nothing animates on it) — a data-cache lifetime, like `BUILD_PARSE_CACHE_MAX`. */
export const JUDGE_VERDICT_CACHE_TTL_MS = 60_000;

/** Cache key for the unscoped (all-catalogs) read the global coach needs. */
const ALL_KEY = '*';

const EMPTY: JudgeVerdict[] = [];
type VerdictRead = Result<JudgeVerdict[], string>;
interface CacheEntry { rows: JudgeVerdict[]; at: number }
/** Successful reads only — a failure is never stored (see the header). */
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<VerdictRead>>();

/** Drop cached verdicts (all, or one catalog) so the next read refetches. Call after any
 *  write to `judge_verdicts`; also the test seam. */
export function invalidateJudgeVerdicts(catalogId?: string): void {
  if (catalogId) {
    cache.delete(catalogId);
    inflight.delete(catalogId);
    // A scoped write also changes the unscoped view.
    cache.delete(ALL_KEY);
    inflight.delete(ALL_KEY);
    return;
  }
  cache.clear();
  inflight.clear();
}

/** Back-compat alias for the original test seam. */
export const clearJudgeVerdictCache = invalidateJudgeVerdicts;

function fresh(key: string): JudgeVerdict[] | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > JUDGE_VERDICT_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return e.rows;
}

function loadVerdicts(key: string): Promise<VerdictRead> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const url = key === ALL_KEY
    ? '/api/judge-verdicts'
    : `/api/judge-verdicts?catalogId=${encodeURIComponent(key)}`;
  const p = tryApiFetch<JudgeVerdict[]>(url).then((r): VerdictRead => {
    // An invalidation while this was in flight dropped it from `inflight`: its answer may
    // predate the write, so it must not be cached over the entry the next read will fetch.
    if (inflight.get(key) === p) {
      inflight.delete(key);
      if (r.ok) cache.set(key, { rows: r.data, at: Date.now() });
    }
    return r;
  });
  inflight.set(key, p);
  return p;
}

/**
 * The whole-project verdict read, KEEPING its failure — for surfaces that grade with verdicts
 * and must say so when they could not read them (/status: `statusVerdictSource`). Same cache,
 * same TTL, same dedupe and same {@link invalidateJudgeVerdicts} as the lab hooks: a fresh
 * cached read resolves without a request, concurrent callers share one in-flight GET.
 */
export function readAllJudgeVerdicts(): Promise<VerdictRead> {
  const rows = fresh(ALL_KEY);
  return rows ? Promise.resolve({ ok: true, data: rows }) : loadVerdicts(ALL_KEY);
}

/** The fresh cached whole-project verdicts, or `undefined` (never read, expired, invalidated
 *  or failed) — lets a remounting view start from a warm cache without a loading flash. */
export function peekAllJudgeVerdicts(): JudgeVerdict[] | undefined {
  return fresh(ALL_KEY);
}

/** Shared subscriber: serves the cached rows for `key`, kicking off (at most) one fetch. */
function useCachedVerdicts(key: string | undefined): JudgeVerdict[] {
  // This counter only re-renders the subscriber once a fetch resolves (no setState during
  // the effect body — the cached value is read straight off the cache on the next render).
  const [loaded, setLoaded] = useState(0);
  const rows = (key ? fresh(key) : undefined) ?? EMPTY;

  useEffect(() => {
    if (!key || fresh(key)) return;
    let live = true;
    // Only a success re-renders (and so re-arms): a failure is not cached, and re-arming on
    // it would re-issue against a dead endpoint on every render.
    void loadVerdicts(key).then((r) => { if (live && r.ok) setLoaded((n) => n + 1); });
    return () => { live = false; };
    // `loaded` re-arms the effect after an expiry so a stale entry is actually refetched.
  }, [key, loaded]);

  return rows;
}

/** Every verdict for a catalog — the input the rail/matrix/coach derivations need to bridge
 *  each of an entity's steps without one fetch per step. */
export function useCatalogJudgeVerdicts(catalogId: string | undefined): JudgeVerdict[] {
  return useCachedVerdicts(catalogId);
}

/** Every verdict across every catalog — for the cross-catalog global coach. */
export function useAllJudgeVerdicts(): JudgeVerdict[] {
  return useCachedVerdicts(ALL_KEY);
}

export function useStepJudgeVerdicts(catalogId: string | undefined, entityId: string, step: string): JudgeVerdict[] {
  const rows = useCachedVerdicts(catalogId);
  // Memoized so the acceptance memo downstream stays referentially stable between renders.
  return useMemo(() => verdictsForStep(rows, entityId, step), [rows, entityId, step]);
}
