import { useState, useCallback } from 'react';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  CreateSessionPayload,
  TriageStatus,
} from '@/types/game-director';
import type { DirectorStats, HealthTrendPoint } from '@/lib/game-director-db';
import { tryApiFetch } from '@/lib/api-utils';
import { unwrapOr } from '@/types/result';
import { useCRUD } from './useCRUD';

interface DirectorData {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  trend: HealthTrendPoint[];
}

const EMPTY: DirectorData = { sessions: [], stats: null, trend: [] };

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
  ) => Promise<PlaytestFinding>;
  markFixDispatched: (findingId: string) => Promise<PlaytestFinding>;
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
  ): Promise<PlaytestFinding> => {
    const result = await tryApiFetch<PlaytestFinding>('/api/game-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-triage', findingId, triageStatus, triageNote, snoozedUntil }),
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
  };
}
