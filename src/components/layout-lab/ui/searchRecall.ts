'use client';

/**
 * SearchCombobox recall: the personal prior of a command surface.
 *
 * An opted-in combobox remembers which hits were picked, per surface (its `idPrefix`), so
 * an empty focused query lists "where you were" and a typed query lists earlier picks
 * first. Two rules keep it honest:
 *
 * - Recents are KEYS (`SearchHit.key`, the stable identity), re-resolved against the live
 *   index on every read — a destination that no longer exists never renders as a dead row.
 * - History only REORDERS the caller's full match set (before the `maxHits` cap); it never
 *   adds a hit that does not match.
 *
 * In memory only (a module-level zustand store, nothing persisted): it outlives the
 * combobox unmounting — `Modal` unmounts its content on every close — but not a reload.
 */

import { useMemo } from 'react';
import { create } from 'zustand';

/** How many picks a surface remembers. */
export const RECALL_MAX = 6;

const NO_KEYS: readonly string[] = [];
const NO_HITS: unknown[] = [];

/** Move `key` to the front (never duplicated), capped at `max`. */
export function pushRecent(keys: readonly string[], key: string, max = RECALL_MAX): string[] {
  return [key, ...keys.filter((k) => k !== key)].slice(0, max);
}

/** Recent keys → live hits, most recent first; keys the index cannot resolve are dropped. */
export function resolveRecents<H>(keys: readonly string[], resolve: (key: string) => H | null): H[] {
  const out: H[] = [];
  for (const k of keys) {
    const hit = resolve(k);
    if (hit != null) out.push(hit);
  }
  return out;
}

/** Stable re-order of a match set: recent matches first (in recency order), the rest in
 *  the caller's order. Nothing outside `matches` is ever added. */
export function rankByRecall<H extends { key: string }>(matches: H[], keys: readonly string[]): H[] {
  if (keys.length === 0) return matches;
  const rank = new Map(keys.map((k, i) => [k, i]));
  const recent = matches.filter((h) => rank.has(h.key));
  if (recent.length === 0) return matches;
  recent.sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
  return [...recent, ...matches.filter((h) => !rank.has(h.key))];
}

interface RecallState {
  /** Recent keys per surface (`idPrefix`), most recent first. */
  bySurface: Record<string, readonly string[]>;
  record: (surface: string, key: string) => void;
}

export const useSearchRecallStore = create<RecallState>()((set) => ({
  bySurface: {},
  record: (surface, key) =>
    set((s) => ({ bySurface: { ...s.bySurface, [surface]: pushRecent(s.bySurface[surface] ?? NO_KEYS, key) } })),
}));

/**
 * The combobox's match set with recall applied. Without `resolve` (recall off) this is
 * exactly `needle ? search(needle) : []` and `record` is a no-op — nothing is remembered.
 * With it, an empty needle yields the resolved recents and a typed one the recall-ranked
 * full match set. `resolve` should be referentially stable (memoised by the caller).
 */
export function useRecallMatches<H extends { key: string }>(
  surface: string,
  resolve: ((key: string) => H | null) | undefined,
  needle: string,
  search: (needle: string) => H[],
): { matches: H[]; record: (key: string) => void } {
  const keys = useSearchRecallStore((s) => (resolve ? (s.bySurface[surface] ?? NO_KEYS) : NO_KEYS));
  const recordKey = useSearchRecallStore((s) => s.record);
  const matches = useMemo(() => {
    if (needle) return rankByRecall(search(needle), keys);
    return resolve ? resolveRecents(keys, resolve) : (NO_HITS as H[]);
  }, [needle, search, resolve, keys]);
  const record = (key: string) => { if (resolve) recordKey(surface, key); };
  return { matches, record };
}
