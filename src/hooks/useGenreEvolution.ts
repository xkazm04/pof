import { useState, useCallback, useEffect } from 'react';
import type {
  TelemetrySnapshot,
  TelemetryStats,
  GenreEvolutionSuggestion,
} from '@/types/telemetry';
import type { DynamicProjectContext } from '@/lib/prompt-context';

export function useGenreEvolution() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [history, setHistory] = useState<TelemetrySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry?action=stats');
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry?action=history&limit=10');
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchHistory()]);
    setLoading(false);
  }, [fetchStats, fetchHistory]);

  useEffect(() => { refresh(); }, [refresh]);

  const scanProject = useCallback(async (
    projectPath: string,
    dynamicContext: DynamicProjectContext | null,
  ) => {
    setScanning(true);
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', projectPath, dynamicContext }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          snapshot: TelemetrySnapshot;
          newSuggestions: GenreEvolutionSuggestion[];
        };
        await refresh();
        return data;
      }
    } finally {
      setScanning(false);
    }
    return null;
  }, [refresh]);

  const resolveSuggestion = useCallback(async (
    suggestionId: string,
    resolveAction: 'accept' | 'dismiss',
  ) => {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', suggestionId, resolveAction }),
    });
    await refresh();
  }, [refresh]);

  return {
    stats,
    history,
    loading,
    scanning,
    refresh,
    scanProject,
    resolveSuggestion,
  };
}
