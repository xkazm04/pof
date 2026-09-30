'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import { planDispatch, type PlanDispatchResult } from '@/lib/implementation-planner/plan-dispatch';
import type { PlanItem } from '@/lib/implementation-planner/plan-generator';
import type { CallbackStatus } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';

interface UsePlanDispatchOptions {
  /** Unique CLI session key for this dispatch site. */
  sessionKey: string;
  /** Terminal tab label. */
  label: string;
  /** Terminal accent color (defaults to the core-engine color). */
  accentColor?: string;
  /**
   * Called after a dispatched item's run ends, AFTER the shared status cache was
   * invalidated on a confirmed landing. `landed` is true only for
   * (success, 'confirmed') — the one outcome that wrote the matrix status.
   */
  onSettled?: (item: PlanItem, landed: boolean, callbackStatus?: CallbackStatus) => void;
}

export interface UsePlanDispatchResult {
  /** Gate + dispatch one plan item. Only call from an explicit user action. */
  dispatch: (item: PlanItem) => PlanDispatchResult;
  isRunning: boolean;
  /** Why the last dispatch was refused or did not land; null after a landing. */
  lastError: string | null;
}

const shortName = (key: string) => key.slice(key.indexOf('::') + 2);

/**
 * The ONE plan dispatch door (table, plan map, Dependencies tab): gates the item
 * through `planDispatch`, runs its feature-fix task via `useModuleCLI.execute`,
 * and on a confirmed landing calls `invalidateFeatureData()` so every plan view
 * (all reading the shared `useFeatureStatuses` cache) re-derives — the built
 * feature leaves the plan and its dependents turn Ready without a manual refresh.
 */
export function usePlanDispatch(opts: UsePlanDispatchOptions): UsePlanDispatchResult {
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlight = useRef<PlanItem | null>(null);
  const onSettledRef = useRef(opts.onSettled);
  useEffect(() => { onSettledRef.current = opts.onSettled; }, [opts.onSettled]);

  const onComplete = useCallback((success: boolean, callbackStatus?: CallbackStatus) => {
    const item = inFlight.current;
    inFlight.current = null;
    if (!item) return;
    const landed = success && callbackStatus === 'confirmed';
    if (landed) {
      invalidateFeatureData();
      setLastError(null);
    } else {
      const why = !success ? 'run failed' : `callback ${callbackStatus ?? 'unconfirmed'}`;
      setLastError(`${item.featureName}: build did not land (${why})`);
    }
    onSettledRef.current?.(item, landed, callbackStatus);
  }, []);

  const { execute, isRunning } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: opts.sessionKey,
    label: opts.label,
    accentColor: opts.accentColor ?? MODULE_COLORS.core,
    onComplete,
  });

  const dispatch = useCallback((item: PlanItem): PlanDispatchResult => {
    const result = planDispatch(item, getAppOrigin());
    if (!result.ok) {
      setLastError(`${item.featureName} is blocked by ${result.error.unmet.map(shortName).join(', ')}`);
      return result;
    }
    setLastError(null);
    inFlight.current = item;
    void execute(result.data);
    return result;
  }, [execute]);

  return { dispatch, isRunning, lastError };
}
