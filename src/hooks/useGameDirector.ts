import { useState, useCallback } from 'react';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  CreateSessionPayload,
} from '@/types/game-director';
import type { DirectorStats } from '@/lib/game-director-db';
import { tryApiFetch } from '@/lib/api-utils';
import { unwrapOr } from '@/types/result';
import { useCRUD } from './useCRUD';

interface DirectorData {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
}

const EMPTY: DirectorData = { sessions: [], stats: null };

const fetchDirectorData = async (): Promise<DirectorData> => {
  const [sessResult, statsResult] = await Promise.all([
    tryApiFetch<PlaytestSession[]>('/api/game-director?action=list'),
    tryApiFetch<DirectorStats>('/api/game-director?action=stats'),
  ]);
  return {
    sessions: sessResult.ok ? sessResult.data : [],
    stats: statsResult.ok ? statsResult.data : null,
  };
};

export interface UseGameDirectorResult {
  sessions: PlaytestSession[];
  stats: DirectorStats | null;
  loading: boolean;
  simulating: boolean;
  refresh: () => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<PlaytestSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  simulatePlaytest: (sessionId: string) => Promise<void>;
  getFindings: (sessionId: string) => Promise<PlaytestFinding[]>;
  getEvents: (sessionId: string) => Promise<DirectorEvent[]>;
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

  const getEvents = useCallback(async (sessionId: string): Promise<DirectorEvent[]> => {
    const result = await tryApiFetch<DirectorEvent[]>(`/api/game-director?action=events&sessionId=${sessionId}`);
    return unwrapOr(result, []);
  }, []);

  return {
    sessions: data.sessions,
    stats: data.stats,
    loading,
    simulating,
    refresh,
    createSession,
    deleteSession,
    simulatePlaytest,
    getFindings,
    getEvents,
  };
}
