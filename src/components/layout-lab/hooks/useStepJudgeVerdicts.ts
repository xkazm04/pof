'use client';

import { useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Read the persisted judge verdicts so every lab surface can apply the same judge →
 * acceptance bridge the headless path applies (`resolveStepAcceptance`).
 *
 * Cheap by construction: ONE `/api/judge-verdicts?catalogId=…` read per catalog (or one
 * unscoped read for the cross-catalog coach), cached and shared by every step of that
 * catalog. Non-throwing — a failed/absent read yields `[]`, i.e. no overlay, never a
 * fabricated verdict.
 *
 * ── Cache invalidation ─────────────────────────────────────────────────────────
 * The cache used to be permanent at module scope with a test-only clear, so a verdict
 * written by the judge fleet mid-session could never reach the screen — the lab showed a
 * stale acceptance for the rest of the page's life. Entries now carry a fetch timestamp and
 * expire after {@link JUDGE_VERDICT_CACHE_TTL_MS}; {@link invalidateJudgeVerdicts} drops them
 * on demand (e.g. after a judge write) without waiting for the TTL.
 */

/** How long a fetched verdict list is served from cache before it is refetched. Not a UI
 *  timing value (nothing animates on it) — a data-cache lifetime, like `BUILD_PARSE_CACHE_MAX`. */
export const JUDGE_VERDICT_CACHE_TTL_MS = 60_000;

/** Cache key for the unscoped (all-catalogs) read the global coach needs. */
const ALL_KEY = '*';

const EMPTY: JudgeVerdict[] = [];
interface CacheEntry { rows: JudgeVerdict[]; at: number }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<JudgeVerdict[]>>();

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

function loadVerdicts(key: string): Promise<JudgeVerdict[]> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const url = key === ALL_KEY
    ? '/api/judge-verdicts'
    : `/api/judge-verdicts?catalogId=${encodeURIComponent(key)}`;
  const p = tryApiFetch<JudgeVerdict[]>(url).then((r) => {
    const rows = r.ok ? r.data : EMPTY;
    cache.set(key, { rows, at: Date.now() });
    inflight.delete(key);
    return rows;
  });
  inflight.set(key, p);
  return p;
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
    void loadVerdicts(key).then(() => { if (live) setLoaded((n) => n + 1); });
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
