import { useState, useCallback } from 'react';
import type {
  TelemetrySnapshot,
  TelemetryStats,
  GenreEvolutionSuggestion,
} from '@/types/telemetry';
import type { DynamicProjectContext } from '@/lib/prompt-context';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { useCRUD } from './useCRUD';

export interface UseGenreEvolutionResult {
  stats: TelemetryStats | null;
  history: TelemetrySnapshot[];
  loading: boolean;
  scanning: boolean;
  /** Human-readable reason the last scan failed; null when the last scan succeeded or none ran. */
  scanError: string | null;
  refresh: () => Promise<void>;
  scanProject: (projectPath: string, dynamicContext: DynamicProjectContext | null) => Promise<{ snapshot: TelemetrySnapshot; newSuggestions: GenreEvolutionSuggestion[] } | null>;
  resolveSuggestion: (suggestionId: string, resolveAction: 'accept' | 'dismiss') => Promise<void>;
}

interface GenreEvolutionData {
  stats: TelemetryStats | null;
  history: TelemetrySnapshot[];
}

const EMPTY: GenreEvolutionData = { stats: null, history: [] };

// Reads are scoped to the ACTIVE project. `telemetry_snapshots` stores the project a
// scan belongs to and every read used to ignore it, so this panel showed another
// project's scans as this one's — and the same unscoped row fed CLI skill injection.
// The project travels explicitly; `stats.scope` reports what was excluded so an empty
// panel says "another project owns these scans" rather than "nobody ever scanned".
const fetchGenreData = async (projectPath: string | null): Promise<GenreEvolutionData> => {
  const q = projectPath ? `&projectPath=${encodeURIComponent(projectPath)}` : '';
  const [stats, history] = await Promise.all([
    apiFetch<TelemetryStats>(`/api/telemetry?action=stats${q}`).catch(() => null),
    apiFetch<TelemetrySnapshot[]>(`/api/telemetry?action=history&limit=10${q}`).catch(() => [] as TelemetrySnapshot[]),
  ]);
  return { stats, history };
};

export function useGenreEvolution(): UseGenreEvolutionResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const fetcher = useCallback(() => fetchGenreData(projectPath), [projectPath]);
  const { data, isLoading: loading, refetch: refresh } = useCRUD<GenreEvolutionData>(
    '/api/telemetry',
    EMPTY,
    { fetcher },
  );

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scanProject = useCallback(async (
    projectPath: string,
    dynamicContext: DynamicProjectContext | null,
  ) => {
    setScanning(true);
    setScanError(null);
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
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The scan request failed — check your connection and try again.';
      console.error('[useGenreEvolution] scanProject failed:', error);
      setScanError(message);
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
    scanError,
    refresh,
    scanProject,
    resolveSuggestion,
  };
}
