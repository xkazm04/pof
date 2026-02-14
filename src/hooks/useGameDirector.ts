import { useState, useCallback, useEffect } from 'react';
import type {
  PlaytestSession,
  PlaytestFinding,
  DirectorEvent,
  CreateSessionPayload,
} from '@/types/game-director';
import type { DirectorStats } from '@/lib/game-director-db';

export function useGameDirector() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [stats, setStats] = useState<DirectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/game-director?action=list');
      if (res.ok) setSessions(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/game-director?action=stats');
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchStats()]);
    setLoading(false);
  }, [fetchSessions, fetchStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(async (payload: CreateSessionPayload) => {
    const res = await fetch('/api/game-director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...payload }),
    });
    const session = await res.json();
    await refresh();
    return session as PlaytestSession;
  }, [refresh]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await fetch(`/api/game-director?sessionId=${sessionId}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const simulatePlaytest = useCallback(async (sessionId: string) => {
    setSimulating(true);
    try {
      await fetch('/api/game-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', sessionId }),
      });
      await refresh();
    } finally {
      setSimulating(false);
    }
  }, [refresh]);

  const getFindings = useCallback(async (sessionId: string): Promise<PlaytestFinding[]> => {
    const res = await fetch(`/api/game-director?action=findings&sessionId=${sessionId}`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  const getEvents = useCallback(async (sessionId: string): Promise<DirectorEvent[]> => {
    const res = await fetch(`/api/game-director?action=events&sessionId=${sessionId}`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  return {
    sessions,
    stats,
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
