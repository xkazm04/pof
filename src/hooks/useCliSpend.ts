'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useIsMounted } from '@/hooks/useIsMounted';
import { budgetPeriods, ENFORCED_BUDGET_ZONE } from '@/lib/cli-spend/budgetPreview';
import type { SpendDashboard, BudgetConfig, BudgetStatus } from '@/types/cli-spend';

/** Placeholder until the first fetch lands; built lazily so its windows are current. */
const emptyBudgetStatus = (): BudgetStatus => ({
  config: { dailyLimitUsd: null, monthlyLimitUsd: null },
  todaySpendUsd: 0,
  monthSpendUsd: 0,
  dailyRemainingUsd: null,
  monthlyRemainingUsd: null,
  dailyPct: null,
  monthlyPct: null,
  dailyExceeded: false,
  monthlyExceeded: false,
  periods: budgetPeriods(new Date(), ENFORCED_BUDGET_ZONE),
});

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

/**
 * Load state carried on the budget status so a consumer can tell "no limit set"
 * from "limits unknown" (a failed or still-pending load keeps the empty default).
 */
export interface BudgetLoadState {
  /** True once a budget fetch has succeeded. */
  isLoaded: boolean;
  /** Message of the latest failed budget fetch; null after a success. */
  loadError: string | null;
  /** Re-run the budget fetch. */
  retry: () => void;
}

export interface UseBudgetResult {
  status: BudgetStatus & BudgetLoadState;
  isSaving: boolean;
  save: (config: BudgetConfig) => Promise<void>;
  refetch: () => Promise<void>;
}

/** Read + persist the daily/monthly budget config and its live status. */
export function useBudget(onSaved?: () => void): UseBudgetResult {
  const [status, setStatus] = useState<BudgetStatus>(emptyBudgetStatus);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isMounted = useIsMounted();

  const refetch = useCallback(async () => {
    try {
      const data = await apiFetch<BudgetStatus>('/api/cli-spend?action=budget');
      if (isMounted()) {
        setStatus(data);
        setIsLoaded(true);
        setLoadError(null);
      }
    } catch (err) {
      // The empty default has null limits: surface the failure so the panel
      // never presents unknown limits as "no limit".
      if (isMounted()) setLoadError(err instanceof Error ? err.message : 'Could not load budget');
    }
  }, [isMounted]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

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

  const merged = useMemo(
    () => ({ ...status, isLoaded, loadError, retry }),
    [status, isLoaded, loadError, retry],
  );

  return { status: merged, isSaving, save, refetch };
}
