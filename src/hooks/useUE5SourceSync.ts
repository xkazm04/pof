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
 */
export function useUE5SourceSync(): UseUE5SourceSyncResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const isSetupComplete = useProjectStore((s) => s.isSetupComplete);
  const [data, setData] = useState<ParsedUE5Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedPathRef = useRef<string | null>(null);

  const fetchData = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    const result = await tryApiFetch<ParsedUE5Data>('/api/ue5-source/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: path }),
    });

    if (result.ok) {
      setData(result.data);
      fetchedPathRef.current = path;
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!projectPath || !isSetupComplete) return;
    // Only fetch once per project path
    if (fetchedPathRef.current === projectPath) return;
    fetchData(projectPath);
  }, [projectPath, isSetupComplete, fetchData]);

  const refresh = useCallback(() => {
    if (!projectPath || !isSetupComplete) return;
    fetchedPathRef.current = null;
    fetchData(projectPath);
  }, [projectPath, isSetupComplete, fetchData]);

  return { data, isLoading, error, refresh };
}
