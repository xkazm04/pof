'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { projectIdOf } from '@/stores/deepEvalStore';
import { mapSource } from '@/lib/evaluator/nexus-signals';
import type { NexusSources, SourceState } from '@/lib/evaluator/nexus-signals';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import type { AnalyticsDashboard, SessionRecord } from '@/types/session-analytics';
import type { PatternLibraryDashboard, ImplementationPattern } from '@/types/pattern-library';

/** How many persisted deep-eval scans Nexus projects (same window as the Scanner tab). */
export const NEXUS_SCAN_LIMIT = 10;

type Settled<T> = { ok: true; data: T } | { ok: false; error: string };

export type RetryableSource<T> = SourceState<T> & { retry: () => void };

/**
 * One GET as a {@link SourceState}. Settled results are cached per URL for this
 * hook's lifetime (re-selecting a module re-reads nothing) and a URL already in
 * flight is not requested twice; `retry` drops that URL's result and re-issues it.
 */
function useSource<T>(url: string | null): RetryableSource<T> {
  const [settled, setSettled] = useState<ReadonlyMap<string, Settled<T>>>(() => new Map());
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!url || settled.has(url) || inFlight.current.has(url)) return;
    inFlight.current.add(url);
    void tryApiFetch<T>(url).then((res) => {
      inFlight.current.delete(url);
      setSettled((prev) => new Map(prev).set(url, res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error }));
    });
  }, [url, settled]);

  const retry = useCallback(() => {
    if (!url) return;
    setSettled((prev) => {
      const next = new Map(prev);
      next.delete(url);
      return next;
    });
  }, [url]);

  const current = url ? settled.get(url) : undefined;
  return useMemo(() => {
    if (!current) return { state: 'loading', retry };
    return current.ok ? { state: 'ready', data: current.data, retry } : { state: 'failed', error: current.error, retry };
  }, [current, retry]);
}

export interface NexusSignalSources {
  /** The three overlay sources, ready to hand to `projectNexusSignals`. */
  sources: Required<NexusSources>;
  /** The pattern rows themselves (the deep-dive lists a module's patterns). */
  patterns: SourceState<readonly ImplementationPattern[]>;
  retryRuns: () => void;
  retryFindings: () => void;
  retryPatterns: () => void;
  /** The selected module's recorded runs, newest first. */
  moduleSessions: RetryableSource<readonly SessionRecord[]>;
}

/**
 * Nexus's data sources: the durable session_analytics, deep-eval and pattern-library
 * reads, each with its own ready / loading / failed state and retry. Read-only —
 * it never writes a store (the Pattern Library tab's filtered slice stays its own).
 */
export function useNexusSignals(selectedModule: string | null): NexusSignalSources {
  const projectId = projectIdOf(useProjectStore((s) => s.projectPath));

  const dashboard = useSource<AnalyticsDashboard>('/api/session-analytics?action=dashboard');
  const scans = useSource<{ scans: PersistedScan[] }>(
    `/api/evaluator/results?limit=${NEXUS_SCAN_LIMIT}&project=${encodeURIComponent(projectId)}`,
  );
  const library = useSource<PatternLibraryDashboard>('/api/pattern-library?action=dashboard');
  const sessions = useSource<{ sessions: SessionRecord[] }>(
    selectedModule ? `/api/session-analytics?action=module&moduleId=${encodeURIComponent(selectedModule)}` : null,
  );

  const runs = useMemo(() => mapSource(dashboard, (d) => d.moduleStats ?? []), [dashboard]);
  const findings = useMemo(() => mapSource(scans, (d) => d.scans ?? []), [scans]);
  const patterns = useMemo(() => mapSource(library, (d) => d.patterns ?? []), [library]);
  const moduleSessions = useMemo(
    () => ({ ...mapSource(sessions, (d) => d.sessions ?? []), retry: sessions.retry }),
    [sessions],
  );

  const sources = useMemo(() => ({ runs, findings, patterns }), [runs, findings, patterns]);

  return {
    sources,
    patterns,
    retryRuns: dashboard.retry,
    retryFindings: scans.retry,
    retryPatterns: library.retry,
    moduleSessions,
  };
}
