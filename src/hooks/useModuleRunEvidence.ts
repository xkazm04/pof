'use client';

/**
 * Real recorded run outcomes for the Next Best Action cards.
 *
 * `useModuleCLI` already POSTs every module dispatch's outcome to
 * `session_analytics` (`recordSessionOutcome`), and
 * `/api/session-analytics?action=module` has read it back since the route was
 * written — with ZERO client consumers. The NBA card meanwhile scored its
 * success odds from `moduleStore.moduleHistory`, a slice whose only writer
 * (`addHistoryEntry`) has no production caller, so the odds always fell through
 * to a hard-coded `0.5` and the card told the user "50% past success on similar
 * work" about work nothing had ever attempted.
 *
 * These hooks close that loop. Both return the same {@link ModuleRunEvidence}
 * shape, and both return `null` while the read is unsettled or failed — a
 * pending read must never be scored as evidence.
 *
 * Fetches are cached and de-duplicated for the process lifetime, the same shape
 * `useModulePatterns` / `useFeatureStatuses` use: a module that never mounts an
 * NBA card never issues a request.
 */

import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { makeRunEvidence, type ModuleRunEvidence } from '@/lib/nba-run-evidence';
import type { SubModuleId } from '@/types/modules';

/** What the card knows about the recorded-run read right now. */
export type RunEvidenceState = 'loading' | 'ready' | 'failed';

export interface ModuleRunEvidenceResult {
  /** `null` until the read settles successfully — never a placeholder rate. */
  evidence: ModuleRunEvidence | null;
  state: RunEvidenceState;
  /** Why the read failed, verbatim from the API envelope. */
  error: string | null;
  retry: () => void;
}

export interface ProjectRunEvidenceResult {
  /** moduleId → evidence. Empty until the read settles. */
  byModule: ReadonlyMap<string, ModuleRunEvidence>;
  state: RunEvidenceState;
  error: string | null;
  retry: () => void;
}

interface CacheEntry<T> {
  data?: T;
  error?: string;
  inFlight?: Promise<void>;
}

const EMPTY_BY_MODULE: ReadonlyMap<string, ModuleRunEvidence> = new Map();

const moduleCache = new Map<string, CacheEntry<ModuleRunEvidence>>();
let projectCache: CacheEntry<ReadonlyMap<string, ModuleRunEvidence>> = {};
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Exposed for tests — the caches are process-wide by design. */
export function __resetRunEvidenceCache() {
  moduleCache.clear();
  projectCache = {};
}

/** One recorded session row, as `?action=module` returns it. */
interface SessionRow {
  success: boolean;
}

function loadModule(moduleId: string): Promise<void> {
  const existing = moduleCache.get(moduleId);
  if (existing?.inFlight) return existing.inFlight;
  if (existing && (existing.data || existing.error)) return Promise.resolve();

  const inFlight = tryApiFetch<{ sessions: SessionRow[] }>(
    `/api/session-analytics?action=module&moduleId=${encodeURIComponent(moduleId)}`,
  ).then((result) => {
    if (result.ok) {
      const sessions = result.data.sessions ?? [];
      let successes = 0;
      for (const s of sessions) if (s.success) successes += 1;
      moduleCache.set(moduleId, { data: makeRunEvidence(sessions.length, successes) });
    } else {
      moduleCache.set(moduleId, { error: result.error });
    }
    notify();
  });

  moduleCache.set(moduleId, { ...existing, inFlight });
  return inFlight;
}

/** Per-module aggregate row, as `?action=dashboard` returns it. */
interface DashboardModuleStats {
  moduleId: string;
  totalSessions: number;
  successCount: number;
}

function loadProject(): Promise<void> {
  if (projectCache.inFlight) return projectCache.inFlight;
  if (projectCache.data || projectCache.error) return Promise.resolve();

  const inFlight = tryApiFetch<{ moduleStats?: DashboardModuleStats[] }>(
    '/api/session-analytics?action=dashboard',
  ).then((result) => {
    if (result.ok) {
      // ONE aggregate read for all ~40 modules — the project card must not fan
      // out into 40 per-module requests to answer one question.
      const map = new Map<string, ModuleRunEvidence>();
      for (const row of result.data.moduleStats ?? []) {
        map.set(row.moduleId, makeRunEvidence(row.totalSessions, row.successCount));
      }
      projectCache = { data: map };
    } else {
      projectCache = { error: result.error };
    }
    notify();
  });

  projectCache = { ...projectCache, inFlight };
  return inFlight;
}

function useCacheSubscription(load: () => Promise<void>, key: string) {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    void load();
    return () => { listeners.delete(listener); };
    // `key` identifies which cache entry this subscription is loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Recorded runs for ONE module.
 *
 * Never throws: a failed read reports `state: 'failed'` with `evidence: null`,
 * so the card scores no odds rather than inventing a neutral rate.
 */
export function useModuleRunEvidence(moduleId: SubModuleId): ModuleRunEvidenceResult {
  useCacheSubscription(() => loadModule(moduleId), moduleId);

  const retry = useCallback(() => {
    moduleCache.delete(moduleId);
    notify();
    void loadModule(moduleId);
  }, [moduleId]);

  const entry = moduleCache.get(moduleId);
  if (entry?.data) return { evidence: entry.data, state: 'ready', error: null, retry };
  if (entry?.error) return { evidence: null, state: 'failed', error: entry.error, retry };
  return { evidence: null, state: 'loading', error: null, retry };
}

/** Recorded runs for EVERY module, from the one dashboard aggregate. */
export function useProjectRunEvidence(): ProjectRunEvidenceResult {
  useCacheSubscription(loadProject, '__project__');

  const retry = useCallback(() => {
    projectCache = {};
    notify();
    void loadProject();
  }, []);

  if (projectCache.data) {
    return { byModule: projectCache.data, state: 'ready', error: null, retry };
  }
  if (projectCache.error) {
    return { byModule: EMPTY_BY_MODULE, state: 'failed', error: projectCache.error, retry };
  }
  return { byModule: EMPTY_BY_MODULE, state: 'loading', error: null, retry };
}
