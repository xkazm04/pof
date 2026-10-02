import { useState, useCallback } from 'react';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  CreateSessionPayload,
  TriageStatus,
  ReproRecord,
} from '@/types/game-director';
import type { DirectorStats, HealthTrendPoint } from '@/lib/game-director-db';
import type { HarnessRunOption, HarnessRunPreview } from '@/lib/game-director/harness-import';
import type { IngestOutcome } from '@/lib/game-director/external-ingest';
import { tryApiFetch } from '@/lib/api-utils';
import { unwrapOr } from '@/types/result';
import { useCRUD } from './useCRUD';

interface DirectorData {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  trend: HealthTrendPoint[];
}

const EMPTY: DirectorData = { sessions: [], stats: null, trend: [] };

/** The preview plus the session this run already became (null = never imported). */
export type HarnessRunPreviewResult = HarnessRunPreview & { ingestedSessionId: string | null };

/**
 * An import that did not write. `existingSessionId` is set when the refusal is
 * "this run is already a session" (409), so the caller can open that session.
 */
export class HarnessImportError extends Error {
  constructor(message: string, readonly existingSessionId: string | null) {
    super(message);
    this.name = 'HarnessImportError';
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const fetchDirectorData = async (): Promise<DirectorData> => {
  const [sessResult, statsResult, trendResult] = await Promise.all([
    tryApiFetch<PlaytestSession[]>('/api/game-director?action=list'),
    tryApiFetch<DirectorStats>('/api/game-director?action=stats'),
    tryApiFetch<HealthTrendPoint[]>('/api/game-director?action=trend'),
  ]);
  return {
    sessions: sessResult.ok ? sessResult.data : [],
    stats: statsResult.ok ? statsResult.data : null,
    trend: trendResult.ok ? trendResult.data : [],
  };
};

export interface UseGameDirectorResult {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  trend: HealthTrendPoint[];
  loading: boolean;
  simulating: boolean;
  refresh: () => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<PlaytestSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  simulatePlaytest: (sessionId: string) => Promise<void>;
  getFindings: (sessionId: string) => Promise<PlaytestFinding[]>;
  getAllFindings: () => Promise<PlaytestFinding[]>;
  getEvents: (sessionId: string) => Promise<DirectorEvent[]>;
  updateTriage: (
    findingId: string,
    triageStatus: TriageStatus,
    triageNote?: string,
    snoozedUntil?: string | null,
    /** Attempt series behind an `unreproducible` verdict; rejected without it. */
    repro?: ReproRecord | null,
  ) => Promise<PlaytestFinding>;
  markFixDispatched: (findingId: string) => Promise<PlaytestFinding>;
  /** Stored harness runs of a project, each with the session it was imported as. */
  listHarnessRuns: (projectId: string) => Promise<HarnessRunOption[]>;
  /** What importing a run would write. Writes nothing; throws the refusal reason. */
  previewHarnessRun: (runId: string, projectId?: string) => Promise<HarnessRunPreviewResult>;
  /** Import a run; resolves the new session id (after refreshing), throws {@link HarnessImportError}. */
  ingestHarnessRun: (runId: string, projectId?: string) => Promise<string>;
}

export function useGameDirector(): UseGameDirectorResult {
  const { data, isLoading: loading, refetch: refresh, mutate } = useCRUD<DirectorData>(
    '/api/game-director',
    EMPTY,
    { fetcher: fetchDirectorData },
  );

  const [simulating, setSimulating] = useState(false);

  const createSession = useCallback(async (payload: CreateSessionPayload) => {
    const result = await tryApiFetch<PlaytestSession>('/api/game-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...payload }),
    });
    if (!result.ok) throw new Error(result.error);
    await refresh();
    return result.data;
  }, [refresh]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const result = await tryApiFetch<{ ok: true }>(`/api/game-director?sessionId=${sessionId}`, { method: 'DELETE' });
    if (!result.ok) throw new Error(result.error);
    await refresh();
  }, [refresh]);

  const simulatePlaytest = useCallback(async (sessionId: string) => {
    setSimulating(true);
    try {
      const result = await tryApiFetch('/api/game-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', sessionId }),
      });
      if (!result.ok) throw new Error(result.error);
      await refresh();
    } finally {
      setSimulating(false);
    }
  }, [refresh]);

  const getFindings = useCallback(async (sessionId: string): Promise<PlaytestFinding[]> => {
    const result = await tryApiFetch<PlaytestFinding[]>(`/api/game-director?action=findings&sessionId=${sessionId}`);
    return unwrapOr(result, []);
  }, []);

  // Single batch fetch backing FindingsExplorer — returns every finding in one
  // request instead of one round-trip per completed session.
  const getAllFindings = useCallback(async (): Promise<PlaytestFinding[]> => {
    const result = await tryApiFetch<PlaytestFinding[]>('/api/game-director?action=all-findings');
    return unwrapOr(result, []);
  }, []);

  const getEvents = useCallback(async (sessionId: string): Promise<DirectorEvent[]> => {
    const result = await tryApiFetch<DirectorEvent[]>(`/api/game-director?action=events&sessionId=${sessionId}`);
    return unwrapOr(result, []);
  }, []);

  const updateTriage = useCallback(async (
    findingId: string,
    triageStatus: TriageStatus,
    triageNote?: string,
    snoozedUntil?: string | null,
    repro?: ReproRecord | null,
  ): Promise<PlaytestFinding> => {
    const result = await tryApiFetch<PlaytestFinding>('/api/game-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-triage', findingId, triageStatus, triageNote, snoozedUntil,
        reproAttempts: repro?.attempts ?? null,
        reproBuildId: repro?.buildId ?? null,
      }),
    });
    if (!result.ok) throw new Error(result.error);
    // Health stats and session findings_count depend on triage; refresh to sync.
    void refresh();
    return result.data;
  }, [refresh]);

  const markFixDispatched = useCallback(async (findingId: string): Promise<PlaytestFinding> => {
    const result = await tryApiFetch<PlaytestFinding>('/api/game-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-fix-dispatched', findingId }),
    });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, []);

  const listHarnessRuns = useCallback(async (projectId: string): Promise<HarnessRunOption[]> => {
    const result = await tryApiFetch<HarnessRunOption[]>(
      `/api/game-director?action=harness-runs&projectId=${encodeURIComponent(projectId)}`,
    );
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, []);

  const previewHarnessRun = useCallback(async (runId: string, projectId?: string) => {
    const result = await tryApiFetch<HarnessRunPreviewResult>('/api/game-director', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'preview-harness-run', runId, projectId }),
    });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, []);

  const ingestHarnessRun = useCallback(async (runId: string, projectId?: string): Promise<string> => {
    // Raw fetch, not tryApiFetch: a 409 carries the existing session id in
    // `details`, and the caller needs it to open that session instead.
    let body: { success: boolean; data?: IngestOutcome; error?: string; details?: { sessionId?: string } };
    try {
      const res = await fetch('/api/game-director', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: 'ingest-harness-run', runId, projectId }),
      });
      body = await res.json();
    } catch (e) {
      throw new HarnessImportError(e instanceof Error ? e.message : 'Network error', null);
    }
    if (!body.success || !body.data) {
      throw new HarnessImportError(body.error ?? 'Import failed', body.details?.sessionId ?? null);
    }
    await refresh();
    return body.data.sessionId;
  }, [refresh]);

  return {
    sessions: data.sessions,
    stats: data.stats,
    trend: data.trend,
    loading,
    simulating,
    refresh,
    createSession,
    deleteSession,
    simulatePlaytest,
    getFindings,
    getAllFindings,
    getEvents,
    updateTriage,
    markFixDispatched,
    listHarnessRuns,
    previewHarnessRun,
    ingestHarnessRun,
  };
}
