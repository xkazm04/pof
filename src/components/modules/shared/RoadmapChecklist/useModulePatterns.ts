'use client';

/**
 * Per-module implementation patterns for the Next Best Action card.
 *
 * The NBA banner has a red "known pitfalls" warning and a success/approach/
 * session metrics row. Both are fed by `usePatternLibraryStore.patterns`, which
 * is a plain `create(...)` store with NO persist middleware — so it is `[]` on
 * every page load and is only ever filled by the *Pattern Library* Evaluator tab
 * (`fetchDashboard` / `searchPatterns`). Nobody opens that tab before pressing
 * Run on a checklist item, so the safety warning that would say "this approach
 * failed last time" was structurally unreachable in production.
 *
 * This hook fetches the same server-side data the library tab reads, scoped to
 * ONE module, and hands it to `computeNBA` explicitly. It deliberately does NOT
 * write `usePatternLibraryStore.patterns`: that slice is the library tab's
 * filtered result set, and a module-scoped write would silently narrow it.
 *
 * Fetches are cached and de-duplicated per module for the process lifetime, the
 * same shape `useFeatureStatuses` uses — a module that never mounts the NBA card
 * never issues a request, and remounting one costs nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';

/** What the card knows about the pattern library right now. */
export type PatternLibraryState = 'loading' | 'ready' | 'failed';

export interface ModulePatternsResult {
  patterns: ImplementationPattern[];
  state: PatternLibraryState;
  /** Why the read failed, verbatim from the API envelope. */
  error: string | null;
  /** Re-run the read (drops the cache for this module first). */
  retry: () => void;
}

const EMPTY: ImplementationPattern[] = [];

interface CacheEntry {
  patterns?: ImplementationPattern[];
  error?: string;
  inFlight?: Promise<void>;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Exposed for tests — the cache is process-wide by design. */
export function __resetModulePatternCache() {
  cache.clear();
}

function load(moduleId: string): Promise<void> {
  const existing = cache.get(moduleId);
  if (existing?.inFlight) return existing.inFlight;
  if (existing && (existing.patterns || existing.error)) return Promise.resolve();

  const params = new URLSearchParams({
    action: 'search',
    moduleId,
    sortBy: 'success-rate',
  });
  const inFlight = tryApiFetch<{ patterns: ImplementationPattern[] }>(
    `/api/pattern-library?${params}`,
  ).then((result) => {
    cache.set(
      moduleId,
      result.ok
        ? { patterns: result.data.patterns ?? EMPTY }
        : { error: result.error },
    );
    notify();
  });

  cache.set(moduleId, { ...existing, inFlight });
  return inFlight;
}

/**
 * Read the implementation patterns recorded for one module.
 *
 * Never throws: a failed read reports `state: 'failed'` with the reason, so the
 * card can say the pitfall check could not run instead of rendering the same
 * silence as "no known pitfalls".
 */
export function useModulePatterns(moduleId: SubModuleId): ModulePatternsResult {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    void load(moduleId);
    return () => { listeners.delete(listener); };
  }, [moduleId]);

  const retry = useCallback(() => {
    cache.delete(moduleId);
    notify();
    void load(moduleId);
  }, [moduleId]);

  const entry = cache.get(moduleId);
  if (entry?.patterns) {
    return { patterns: entry.patterns, state: 'ready', error: null, retry };
  }
  if (entry?.error) {
    return { patterns: EMPTY, state: 'failed', error: entry.error, retry };
  }
  return { patterns: EMPTY, state: 'loading', error: null, retry };
}
