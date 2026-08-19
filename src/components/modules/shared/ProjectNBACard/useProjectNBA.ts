'use client';

import { useMemo } from 'react';
import { computeProjectNBA, type NBARecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useProjectRunEvidence } from '@/hooks/useModuleRunEvidence';
import type { ProjectScopeReport } from '@/lib/feature-matrix-db';

export interface UseProjectNBAResult {
  /** Top recommendations across EVERY sub-module, best first. */
  recommendations: NBARecommendation[];
  isLoading: boolean;
  /**
   * What the project scope let the cross-module status read see. A project-wide
   * ranking computed from a foreign-scoped read must be able to say so — the
   * same disclosure the per-module card carries.
   */
  scope: ProjectScopeReport | null;
  /** How many feature rows the scoped read returned in total. */
  visibleRows: number;
}

/**
 * Whole-project Next Best Actions.
 *
 * Wraps {@link computeProjectNBA}, which was fully built and unit-tested but had
 * ZERO non-test callers — its docstring claimed it powered a "Mission Control"
 * surface that has never existed in this repo. This hook is the real caller.
 *
 * It reuses the shared, deduped cross-module status map (so mounting this card
 * costs no extra `/api/feature-matrix/all-statuses` read when a matrix is also
 * mounted) and the ONE `session_analytics` dashboard aggregate for every
 * module's recorded runs — never 40 per-module requests.
 *
 * `computeProjectNBA` runs `computeNBA` ~40 times, so the result is memoized on
 * exactly the inputs that can change it.
 */
export function useProjectNBA(limit = 4): UseProjectNBAResult {
  const { statusMap, isLoading: statusesLoading, loaded, failed, scope } = useFeatureStatuses();
  const { byModule } = useProjectRunEvidence();

  // Any checklist toggle in any module changes the candidate set, so the whole
  // progress map is the recompute trigger (the engine reads it from the store).
  const progress = useModuleStore((s) => s.checklistProgress);

  const recommendations = useMemo<NBARecommendation[]>(() => {
    if (!loaded) return [];
    void progress;
    return computeProjectNBA(failed ? undefined : statusMap, limit, byModule);
  }, [statusMap, loaded, failed, progress, limit, byModule]);

  return {
    recommendations,
    isLoading: !loaded && statusesLoading,
    scope,
    visibleRows: statusMap.size,
  };
}
