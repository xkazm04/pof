'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { GenerationRunBase } from '@/types/procgen';

/**
 * Load a UE generation panel's run history (newest first), refreshed whenever a
 * run finishes.
 *
 * ONE request serves both the panel's "last run" line and its history list —
 * `runs[0]` IS the latest run, so a second `latest` round trip would only be a
 * chance for the two to disagree. A failed load is returned, never swallowed.
 */
export function useRunHistory<T extends GenerationRunBase>(
  endpoint: string,
  isGenerating: boolean,
): { runs: T[]; error: string | null } {
  const [runs, setRuns] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Same rule as before: never poll while a generation is in flight.
    if (isGenerating) return;
    let cancelled = false;
    void (async () => {
      const r = await tryApiFetch<{ runs?: T[] } | null>(`${endpoint}?history=1`);
      if (cancelled) return;
      if (r.ok) {
        setRuns(r.data?.runs ?? []);
        setError(null);
      } else {
        setError(r.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, isGenerating]);

  return { runs, error };
}
