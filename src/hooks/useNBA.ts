'use client';

import { useMemo, useCallback } from 'react';
import { computeNBA, type NBARecommendation } from '@/lib/nba-engine';
import { useModuleStore } from '@/stores/moduleStore';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import { countModuleRows } from '@/components/modules/shared/FeatureMatrix/matrixScope';
import type { ProjectScopeReport } from '@/lib/feature-matrix-db';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';

export interface UseNBAResult {
  recommendations: NBARecommendation[];
  top: NBARecommendation | null;
  isLoading: boolean;
  /**
   * What the project scope let the status read see (`null` until it settles).
   * NBA scores a feature it cannot see as unimplemented, so rows owned by another
   * project produce confident "do this next" advice about work that may already be
   * reviewed — the card must be able to say so.
   */
  scope: ProjectScopeReport | null;
  /** How many rows of THIS module the scoped read returned (0 ⇒ nothing in view). */
  scopedRows: number;
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
export function useNBA(
  moduleId: SubModuleId,
  /**
   * Module-scoped implementation patterns. Optional so existing callers are
   * unchanged; when omitted `computeNBA` falls back to the pattern-library store
   * slice, which only the Pattern Library evaluator tab ever fills.
   */
  modulePatterns?: readonly ImplementationPattern[],
): UseNBAResult {
  // Shared, deduped cross-module status map (same data the Feature Matrix reads).
  const { statusMap, isLoading: statusesLoading, loaded, failed, scope } = useFeatureStatuses();

  // Subscribe to progress so a checklist toggle re-scores (computeNBA reads
  // checklist state from the store; `progress` is the recompute trigger).
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);

  // Derived during render (not via setState-in-effect): recompute when the module,
  // the shared status map, or progress changes. Hold off until statuses settle;
  // then compute with the map (or without it on failure — the prior fallback).
  const recommendations = useMemo<NBARecommendation[]>(() => {
    if (!loaded) return [];
    void progress;
    return failed
      ? computeNBA(moduleId, undefined, modulePatterns)
      : computeNBA(moduleId, statusMap, modulePatterns);
  }, [moduleId, statusMap, loaded, failed, progress, modulePatterns]);

  // Force a refetch of the shared status map; the memo recomputes when it
  // updates. NBA itself reads only the statuses, but a user-driven refresh means
  // "re-read the matrix" — dropping the statuses while leaving the roll-up cached
  // would refresh this card into disagreeing with the dashboards beside it.
  const refresh = useCallback(() => { invalidateFeatureData(); }, []);

  const isLoading = !loaded && statusesLoading;
  const top = recommendations[0] ?? null;

  // Rows of this module the scoped read actually returned. `computeNBA` falls back
  // to "unknown" for every key it misses, so this count is the only way the card
  // can distinguish "nothing reviewed here" from "another project holds it all".
  const scopedRows = useMemo(() => countModuleRows(statusMap, moduleId), [statusMap, moduleId]);

  return { recommendations, top, isLoading, scope, scopedRows, refresh };
}
