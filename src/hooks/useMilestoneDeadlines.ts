'use client';

/**
 * The declared milestone deadlines, for the Next Best Action cards.
 *
 * `milestone_deadlines` is written by the calendar roadmap and served by
 * `/api/milestone-deadlines`, and until this hook existed NOTHING read it into
 * a decision — the recommendation engine had no deadline term at all, so a
 * milestone due next week and one due next quarter ranked identically.
 *
 * Shape mirrors {@link useModuleRunEvidence}: one process-lifetime cache, one
 * in-flight request shared by every mounted card, and a failed read reports
 * `null` rather than an empty object — "we could not read the commitments" and
 * "there are no commitments" are different facts and the engine scores them
 * the same only by accident. `deadlines: null` means the engine is called
 * without the parameter, which contributes nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { MilestoneDeadlineMap } from '@/lib/nba-deadline';
import { ok, err, type Result } from '@/types/result';

export type MilestoneDeadlineState = 'loading' | 'ready' | 'failed';

export interface MilestoneDeadlinesResult {
  /** milestoneId → deadline, or `null` while unsettled or failed. */
  deadlines: MilestoneDeadlineMap | null;
  state: MilestoneDeadlineState;
  /** Why the read failed, verbatim from the API envelope. */
  error: string | null;
  retry: () => void;
}

interface Cache {
  data?: MilestoneDeadlineMap;
  error?: string;
  inFlight?: Promise<void>;
}

let cache: Cache = {};
/** Bumped whenever the cache is dropped, so a read started before the drop never seats itself. */
let generation = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/**
 * A deadline was written (the calendar roadmap is the one writer): drop the
 * cache and re-read for every mounted card, so the next-best-action ranks
 * against the deadline just set instead of the mount-time read.
 */
export function invalidateMilestoneDeadlines() {
  generation++;
  cache = {};
  notify();
  if (listeners.size > 0) void load();
}

/**
 * The shared read for non-hook callers (the roadmap editor): the same cache and
 * the same single in-flight request the NBA cards use, so there is one read path.
 */
export async function readMilestoneDeadlines(): Promise<Result<MilestoneDeadlineMap, string>> {
  // An editor opening again is a retry: a cached failure must not stick to it.
  if (cache.error) { generation++; cache = {}; }
  for (let attempt = 0; attempt < 3; attempt++) {
    await load();
    if (cache.data) return ok(cache.data);
    if (cache.error) return err(cache.error);
    // Invalidated while the read was in flight: read again.
  }
  return err('Deadlines could not be read');
}

/** Exposed for tests — the cache is process-wide by design. */
export function __resetMilestoneDeadlineCache() {
  generation++;
  cache = {};
}

function load(): Promise<void> {
  if (cache.inFlight) return cache.inFlight;
  if (cache.data || cache.error) return Promise.resolve();

  const gen = generation;
  const inFlight = tryApiFetch<MilestoneDeadlineMap>('/api/milestone-deadlines')
    .then((result) => {
      // The cache was dropped while this read was in flight: its answer predates the drop.
      if (gen !== generation) return;
      cache = result.ok ? { data: result.data ?? {} } : { error: result.error };
      notify();
    });

  cache = { ...cache, inFlight };
  return inFlight;
}

export function useMilestoneDeadlines(): MilestoneDeadlinesResult {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    void load();
    return () => { listeners.delete(listener); };
  }, []);

  const retry = useCallback(() => {
    generation++;
    cache = {};
    notify();
    void load();
  }, []);

  if (cache.data) return { deadlines: cache.data, state: 'ready', error: null, retry };
  if (cache.error) return { deadlines: null, state: 'failed', error: cache.error, retry };
  return { deadlines: null, state: 'loading', error: null, retry };
}
