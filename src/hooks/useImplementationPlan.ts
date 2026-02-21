'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  generatePlan,
  type ImplementationPlan,
  type PlanFilter,
} from '@/lib/implementation-planner/plan-generator';
import { apiFetch } from '@/lib/api-utils';
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

export function useImplementationPlan(options: UseImplementationPlanOptions = {}): UseImplementationPlanResult {
  const [plan, setPlan] = useState<ImplementationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanFilter>(options.filter ?? {});
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all feature statuses from the API
      const data = await apiFetch<{ statuses: { moduleId: string; featureName: string; status: string }[] }>('/api/feature-matrix/all-statuses');

      // Build status map
      const statusMap = new Map<string, string>();
      for (const entry of data.statuses ?? []) {
        statusMap.set(`${entry.moduleId}::${entry.featureName}`, entry.status);
      }

      // Generate plan (runs synchronously — all computation is client-side)
      const result = generatePlan(statusMap, filterRef.current);
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and refetch when filter changes
  useEffect(() => {
    fetchPlan();
  }, [filter, fetchPlan]);

  // Auto-refresh — pauses when module is suspended (hidden in LRU)
  useSuspendableEffect(() => {
    if (!options.refreshInterval || options.refreshInterval <= 0) return;
    const interval = setInterval(fetchPlan, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, fetchPlan]);

  const updateFilter = useCallback((newFilter: Partial<PlanFilter>) => {
    setFilter((prev) => ({ ...prev, ...newFilter }));
  }, []);

  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);

  return {
    plan,
    loading,
    error,
    filter,
    updateFilter,
    clearFilter,
    refresh: fetchPlan,
  };
}
