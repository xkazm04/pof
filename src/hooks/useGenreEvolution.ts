import { useState, useCallback } from 'react';
import type {
  TelemetrySnapshot,
  TelemetryStats,
  GenreEvolutionSuggestion,
} from '@/types/telemetry';
import type { DynamicProjectContext } from '@/lib/prompt-context';
import { apiFetch } from '@/lib/api-utils';
import { useCRUD } from './useCRUD';

export interface UseGenreEvolutionResult {
  stats: TelemetryStats | null;
  history: TelemetrySnapshot[];
  loading: boolean;
  scanning: boolean;
  refresh: () => Promise<void>;
  scanProject: (projectPath: string, dynamicContext: DynamicProjectContext | null) => Promise<{ snapshot: TelemetrySnapshot; newSuggestions: GenreEvolutionSuggestion[] } | null>;
  resolveSuggestion: (suggestionId: string, resolveAction: 'accept' | 'dismiss') => Promise<void>;
}

interface GenreEvolutionData {
  stats: TelemetryStats | null;
  history: TelemetrySnapshot[];
}

const EMPTY: GenreEvolutionData = { stats: null, history: [] };

const fetchGenreData = async (): Promise<GenreEvolutionData> => {
  const [stats, history] = await Promise.all([
    apiFetch<TelemetryStats>('/api/telemetry?action=stats').catch(() => null),
    apiFetch<TelemetrySnapshot[]>('/api/telemetry?action=history&limit=10').catch(() => [] as TelemetrySnapshot[]),
  ]);
  return { stats, history };
};

export function useGenreEvolution(): UseGenreEvolutionResult {
  const { data, isLoading: loading, refetch: refresh } = useCRUD<GenreEvolutionData>(
    '/api/telemetry',
    EMPTY,
    { fetcher: fetchGenreData },
  );

  const [scanning, setScanning] = useState(false);

  const scanProject = useCallback(async (
    projectPath: string,
    dynamicContext: DynamicProjectContext | null,
  ) => {
    setScanning(true);
    try {
      const result = await apiFetch<{
        snapshot: TelemetrySnapshot;
        newSuggestions: GenreEvolutionSuggestion[];
      }>('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', projectPath, dynamicContext }),
      });
      await refresh();
      return result;
    } catch {
      return null;
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const resolveSuggestion = useCallback(async (
    suggestionId: string,
    resolveAction: 'accept' | 'dismiss',
  ) => {
    await apiFetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', suggestionId, resolveAction }),
    });
    await refresh();
  }, [refresh]);

  return {
    stats: data.stats,
    history: data.history,
    loading,
    scanning,
    refresh,
    scanProject,
    resolveSuggestion,
  };
}
