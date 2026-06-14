'use client';

import { useState, useEffect, useCallback } from 'react';
import { computeNBA, type NBARecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
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
  const [recommendations, setRecommendations] = useState<NBARecommendation[]>([]);

  // Shared, deduped cross-module status map (same data the Feature Matrix reads).
  const { statusMap, isLoading: statusesLoading, loaded, failed } = useFeatureStatuses();

  // Subscribe to progress changes to re-compute
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);

  // Re-compute whenever the module, the shared status map, or progress changes.
  // While statuses are still loading we hold off; once settled we compute with
  // the map (or without it on failure, matching the prior fallback behaviour).
  useEffect(() => {
    if (!loaded) return;
    setRecommendations(failed ? computeNBA(moduleId) : computeNBA(moduleId, statusMap));
    // progress is included so a checklist toggle re-scores; statusMap identity
    // changes when the shared cache refreshes.
  }, [moduleId, statusMap, loaded, failed, progress]);

  const refresh = useCallback(() => {
    setRecommendations(failed ? computeNBA(moduleId) : computeNBA(moduleId, statusMap));
  }, [moduleId, statusMap, failed]);

  const isLoading = !loaded && statusesLoading;
  const top = recommendations[0] ?? null;

  return { recommendations, top, isLoading, refresh };
}
