'use client';

import { useMemo, useCallback } from 'react';
import { computeNBA, type NBARecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { useFeatureStatuses, invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import type { SubModuleId } from '@/types/modules';

export interface UseNBAResult {
  recommendations: NBARecommendation[];
  top: NBARecommendation | null;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook that computes Next Best Action recommendations for a module.
 *
 * Cross-module feature statuses come from the shared {@link useFeatureStatuses}
 * cache, so when the NBA card and the Feature Matrix mount for the same module
 * view they share ONE fetch of `/api/feature-matrix/all-statuses` + one `Map`
 * instead of each running the unfiltered table scan independently. NBA then
 * re-computes when progress changes or when the shared status map updates.
 */
export function useNBA(moduleId: SubModuleId): UseNBAResult {
  // Shared, deduped cross-module status map (same data the Feature Matrix reads).
  const { statusMap, isLoading: statusesLoading, loaded, failed } = useFeatureStatuses();

  // Subscribe to progress so a checklist toggle re-scores (computeNBA reads
  // checklist state from the store; `progress` is the recompute trigger).
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);

  // Derived during render (not via setState-in-effect): recompute when the module,
  // the shared status map, or progress changes. Hold off until statuses settle;
  // then compute with the map (or without it on failure — the prior fallback).
  const recommendations = useMemo<NBARecommendation[]>(() => {
    if (!loaded) return [];
    void progress;
    return failed ? computeNBA(moduleId) : computeNBA(moduleId, statusMap);
  }, [moduleId, statusMap, loaded, failed, progress]);

  // Force a refetch of the shared status map; the memo recomputes when it updates.
  const refresh = useCallback(() => { invalidateFeatureStatuses(); }, []);

  const isLoading = !loaded && statusesLoading;
  const top = recommendations[0] ?? null;

  return { recommendations, top, isLoading, refresh };
}
