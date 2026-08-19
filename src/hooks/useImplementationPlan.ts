'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  generatePlan,
  type ImplementationPlan,
  type PlanFilter,
} from '@/lib/implementation-planner/plan-generator';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useSuspendableEffect } from '@/hooks/useSuspend';

export interface UseImplementationPlanResult {
  plan: ImplementationPlan | null;
  loading: boolean;
  error: string | null;
  filter: PlanFilter;
  updateFilter: (newFilter: Partial<PlanFilter>) => void;
  clearFilter: () => void;
  refresh: () => Promise<void>;
}

interface UseImplementationPlanOptions {
  /** Auto-refresh interval in ms (0 = disabled). Default: 0 */
  refreshInterval?: number;
  /** Initial filter */
  filter?: PlanFilter;
}

/**
 * The implementation plan is a pure function of the cross-module status table +
 * the active filter. Statuses come from the shared {@link useFeatureStatuses}
 * path (one fetch for every consumer of `/api/feature-matrix/all-statuses`);
 * `generatePlan` runs synchronously on the client, so a filter change re-derives
 * the plan without touching the network at all — it used to refetch the whole
 * table on every filter keystroke.
 */
export function useImplementationPlan(options: UseImplementationPlanOptions = {}): UseImplementationPlanResult {
  const [filter, setFilter] = useState<PlanFilter>(options.filter ?? {});
  const { statusMap, isLoading, loaded, failed, error, refresh: refreshStatuses } = useFeatureStatuses();

  const plan = useMemo(() => {
    // A failed load must not be rendered as "no features anywhere" — the caller
    // shows `error` instead, so leave the plan null.
    if (!loaded || failed) return null;
    return generatePlan(statusMap, filter);
  }, [statusMap, filter, loaded, failed]);

  const refresh = useCallback(async () => { refreshStatuses(); }, [refreshStatuses]);

  // Auto-refresh — pauses when module is suspended (hidden in LRU). Invalidating
  // the shared cache refreshes every consumer, not just this one.
  useSuspendableEffect(() => {
    if (!options.refreshInterval || options.refreshInterval <= 0) return;
    const interval = setInterval(refreshStatuses, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, refreshStatuses]);

  const updateFilter = useCallback((newFilter: Partial<PlanFilter>) => {
    setFilter((prev) => ({ ...prev, ...newFilter }));
  }, []);

  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);

  return {
    plan,
    loading: isLoading && !loaded,
    error: failed ? (error ?? 'Failed to generate plan') : null,
    filter,
    updateFilter,
    clearFilter,
    refresh,
  };
}
