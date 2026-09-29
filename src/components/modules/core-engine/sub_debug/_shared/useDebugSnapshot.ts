'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import type { ProfilingSession, TriageResult } from '@/types/performance-profiling';
import { projectDebugSnapshot, type DebugProvenance, type DebugSnapshot } from './debugSnapshot';
import { SAMPLE_SESSION } from './sampleSession';

export interface DebugSnapshotState {
  snapshot: DebugSnapshot;
  provenance: DebugProvenance;
  /** True once the profiler's session list has been read (sample or not). */
  listed: boolean;
}

const SAMPLE_SNAPSHOT = projectDebugSnapshot(SAMPLE_SESSION, null);
const SAMPLE_PROVENANCE: DebugProvenance = { kind: 'sample' };

interface Loaded { id: string; snapshot: DebugSnapshot; provenance: DebugProvenance }

/**
 * The Debug tab's reader. The session LIST is the profiling store's
 * (`listSessions` / `sessionList`, shared with the Evaluator's session rail, so
 * a capture taken there shows up here); the newest row's body is read with a
 * side-effect-free get-session, because the store's `loadSession` would move
 * the Evaluator's own selection. No session -> the SAMPLE_SESSION fixture.
 */
export function useDebugSnapshot(): DebugSnapshotState {
  const newest = usePerformanceProfilingStore((s) => s.sessionList[0]);
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
    void tryApiFetch<{ session: ProfilingSession | null; triage: TriageResult | null }>(
      '/api/performance-profiling',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-session', sessionId: newestId }),
      },
    ).then((res) => {
      if (!live || !res.ok || !res.data.session) return;
      const { session, triage } = res.data;
      setLoaded({
        id: session.id,
        snapshot: projectDebugSnapshot(session, triage),
        provenance: { kind: 'session', source: session.source, name: session.name, importedAt: session.importedAt },
      });
    });
    return () => { live = false; };
  }, [newestId]); // keyed on the id: a re-listed row for the same session is not a new capture

  // A deleted newest session falls back to the sample without a reset effect.
  if (loaded && newest && loaded.id === newest.id) {
    return { snapshot: loaded.snapshot, provenance: loaded.provenance, listed };
  }
  return { snapshot: SAMPLE_SNAPSHOT, provenance: SAMPLE_PROVENANCE, listed };
}
