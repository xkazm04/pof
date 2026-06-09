'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import type { SpendDashboard, BudgetConfig, BudgetStatus } from '@/types/cli-spend';

const EMPTY_BUDGET_STATUS: BudgetStatus = {
  config: { dailyLimitUsd: null, monthlyLimitUsd: null },
  todaySpendUsd: 0,
  monthSpendUsd: 0,
  dailyRemainingUsd: null,
  monthlyRemainingUsd: null,
  dailyPct: null,
  monthlyPct: null,
  dailyExceeded: false,
  monthlyExceeded: false,
};

export interface UseSpendDashboardResult {
  dashboard: SpendDashboard | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Load the full spend dashboard (per-run / per-module / per-task-type rollups). */
export function useSpendDashboard(): UseSpendDashboardResult {
  const [dashboard, setDashboard] = useState<SpendDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SpendDashboard>('/api/cli-spend?action=dashboard');
      if (isMounted()) setDashboard(data);
    } catch (err) {
      if (isMounted()) setError(err instanceof Error ? err.message : 'Failed to load spend dashboard');
    } finally {
      if (isMounted()) setIsLoading(false);
    }
  }, [isMounted]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { dashboard, isLoading, error, refetch };
}

export interface UseBudgetResult {
  status: BudgetStatus;
  isSaving: boolean;
  save: (config: BudgetConfig) => Promise<void>;
  refetch: () => Promise<void>;
}

/** Read + persist the daily/monthly budget config and its live status. */
export function useBudget(onSaved?: () => void): UseBudgetResult {
  const [status, setStatus] = useState<BudgetStatus>(EMPTY_BUDGET_STATUS);
  const [isSaving, setIsSaving] = useState(false);
  const isMounted = useIsMounted();

  const refetch = useCallback(async () => {
    try {
      const data = await apiFetch<BudgetStatus>('/api/cli-spend?action=budget');
      if (isMounted()) setStatus(data);
    } catch {
      // Non-critical — keep the empty default.
    }
  }, [isMounted]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const save = useCallback(
    async (config: BudgetConfig) => {
      setIsSaving(true);
      try {
        await apiFetch<unknown>('/api/cli-spend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-budget', ...config }),
        });
        await refetch();
        onSaved?.();
      } finally {
        if (isMounted()) setIsSaving(false);
      }
    },
    [refetch, onSaved, isMounted],
  );

  return { status, isSaving, save, refetch };
}
