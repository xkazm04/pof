'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { computeNBA, type NBARecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import type { SubModuleId } from '@/types/modules';

export interface UseNBAResult {
  recommendations: NBARecommendation[];
  top: NBARecommendation | null;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook that computes Next Best Action recommendations for a module.
 * Fetches feature statuses once, then re-computes when progress changes.
 */
export function useNBA(moduleId: SubModuleId): UseNBAResult {
  const [recommendations, setRecommendations] = useState<NBARecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const statusMapRef = useRef<Map<string, string>>(new Map());

  // Subscribe to progress changes to re-compute
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);

  // Fetch feature statuses once
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch('/api/feature-matrix/all-statuses')
      .then((r) => (r.ok ? r.json() : { statuses: [] }))
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const row of data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        statusMapRef.current = map;
        setRecommendations(computeNBA(moduleId, map));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Compute without status data — still useful
        setRecommendations(computeNBA(moduleId));
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [moduleId]);

  // Re-compute when progress changes (but not on first mount — the effect above handles that)
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }
    setRecommendations(computeNBA(moduleId, statusMapRef.current));
  }, [moduleId, progress]);

  const refresh = useCallback(() => {
    setRecommendations(computeNBA(moduleId, statusMapRef.current));
  }, [moduleId]);

  const top = recommendations[0] ?? null;

  return { recommendations, top, isLoading, refresh };
}
