'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import type { ProfilingSession, TriageResult } from '@/types/performance-profiling';
import type { SessionComparisonResponse } from '@/lib/profiling/session-compare';
import { projectDebugSnapshot, type DebugProvenance, type DebugSnapshot } from './debugSnapshot';
import type { LatestTriage } from './optimizationQueue';
import { SAMPLE_SESSION } from './sampleSession';

export interface DebugSnapshotState {
  snapshot: DebugSnapshot;
  provenance: DebugProvenance;
  /** True once the profiler's session list has been read (sample or not). */
  listed: boolean;
  /** The newest session's triage (run when missing) + its compare against the previous real capture. */
  latest: LatestTriage;
}

const SAMPLE_SNAPSHOT = projectDebugSnapshot(SAMPLE_SESSION, null);
const SAMPLE_PROVENANCE: DebugProvenance = { kind: 'sample' };
const LOADING: LatestTriage = { kind: 'loading' };
const NO_CAPTURE: LatestTriage = { kind: 'no-capture' };

interface Loaded { id: string; snapshot: DebugSnapshot; provenance: DebugProvenance; latest: LatestTriage }

function postProfiling<T>(body: Record<string, unknown>) {
  return tryApiFetch<T>('/api/performance-profiling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A generated sample is not a capture: it is never a compare base or head. */
const isCapture = (source: string | undefined) => source !== undefined && source !== 'manual';

/**
 * The Debug tab's reader. The session LIST is the profiling store's
 * (`listSessions` / `sessionList`, shared with the Evaluator's session rail, so
 * a capture taken there shows up here); the newest row's body is read with a
 * side-effect-free get-session, because the store's `loadSession` would move
 * the Evaluator's own selection. Its triage is run when missing (rule-based,
 * local) and, when both are real captures, it is compared against the previous
 * capture — the queue's verification signal. No session -> the SAMPLE_SESSION.
 */
export function useDebugSnapshot(): DebugSnapshotState {
  const newest = usePerformanceProfilingStore((s) => s.sessionList[0]);
  const baseId = usePerformanceProfilingStore((s) =>
    isCapture(s.sessionList[0]?.source) ? s.sessionList.slice(1).find((r) => isCapture(r.source))?.id : undefined);
  const [listed, setListed] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    void usePerformanceProfilingStore.getState().listSessions().then(() => { if (live) setListed(true); });
    return () => { live = false; };
  }, []);

  const newestId = newest?.id;
  useEffect(() => {
    if (!newestId) return;
    let live = true;
    void (async () => {
      const res = await postProfiling<{ session: ProfilingSession | null; triage: TriageResult | null }>(
        { action: 'get-session', sessionId: newestId },
      );
      if (!live) return;
      if (!res.ok || !res.data.session) {
        const reason = res.ok ? 'Session not found' : res.error;
        setLoaded({ id: newestId, snapshot: SAMPLE_SNAPSHOT, provenance: SAMPLE_PROVENANCE, latest: { kind: 'unavailable', reason } });
        return;
      }
      const { session } = res.data;
      const provenance: DebugProvenance = { kind: 'session', source: session.source, name: session.name, importedAt: session.importedAt };
      setLoaded({ id: session.id, snapshot: projectDebugSnapshot(session, res.data.triage), provenance, latest: LOADING });

      const [triaged, compared] = await Promise.all([
        res.data.triage
          ? Promise.resolve(res.data.triage)
          : postProfiling<{ triage: TriageResult }>({ action: 'triage', sessionId: session.id }).then((r) => (r.ok ? r.data.triage ?? null : null)),
        baseId
          ? postProfiling<SessionComparisonResponse>({ action: 'compare', baseId, headId: session.id }).then((r) => (r.ok && r.data?.findings ? r.data : null))
          : Promise.resolve(null),
      ]);
      if (!live) return;
      const head = { id: session.id, name: session.name, source: session.source, importedAt: session.importedAt };
      setLoaded({
        id: session.id,
        snapshot: projectDebugSnapshot(session, triaged),
        provenance,
        latest: { kind: 'ready', session: head, triage: triaged, comparison: compared },
      });
    })();
    return () => { live = false; };
  }, [newestId, baseId]); // keyed on ids: a re-listed row for the same session is not a new capture

  if (listed && !newest) return { snapshot: SAMPLE_SNAPSHOT, provenance: SAMPLE_PROVENANCE, listed, latest: NO_CAPTURE };
  // A deleted newest session falls back to the sample without a reset effect.
  if (loaded && newest && loaded.id === newest.id) {
    return { snapshot: loaded.snapshot, provenance: loaded.provenance, listed, latest: loaded.latest };
  }
  return { snapshot: SAMPLE_SNAPSHOT, provenance: SAMPLE_PROVENANCE, listed, latest: LOADING };
}
