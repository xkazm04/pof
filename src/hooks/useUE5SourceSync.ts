'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import type { ParsedUE5Data } from '@/lib/ue5-source-parser';

interface UseUE5SourceSyncResult {
  data: ParsedUE5Data | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook that fetches parsed UE5 ability system data from the project's C++ source files.
 * Returns null data if no project is configured.
 *
 * Last request wins: an answer that is no longer the newest request for the
 * current project is dropped, and `isLoading` is derived from the project the
 * load was for, so abandoning a load can never leave the spinner on.
 */
export function useUE5SourceSync(): UseUE5SourceSyncResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const [data, setData] = useState<ParsedUE5Data | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedPathRef = useRef<string | null>(null);
  const latestRequestRef = useRef(0);

  const load = useCallback(async (path: string) => {
    const requestId = ++latestRequestRef.current;
    setLoadingPath(path);
    setError(null);

    const result = await tryApiFetch<ParsedUE5Data>('/api/ue5-source/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: path }),
    });
    if (requestId !== latestRequestRef.current) return;

    if (result.ok) {
      setData(result.data);
      fetchedPathRef.current = path;
    } else {
      setError(result.error);
    }
    setLoadingPath(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (projectPath && isSetupComplete && fetchedPathRef.current !== projectPath) {
      void Promise.resolve().then(() => {
        if (!cancelled) void load(projectPath);
      });
    }
    return () => {
      cancelled = true;
      latestRequestRef.current += 1; // whatever is in flight was for the previous project
    };
  }, [projectPath, isSetupComplete, load]);

  const refresh = useCallback(() => {
    if (!projectPath || !isSetupComplete) return;
    fetchedPathRef.current = null;
    void load(projectPath);
  }, [projectPath, isSetupComplete, load]);

  const isLoading = isSetupComplete && loadingPath !== null && loadingPath === projectPath;
  return { data, isLoading, error, refresh };
}
