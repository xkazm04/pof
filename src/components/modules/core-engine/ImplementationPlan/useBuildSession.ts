'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import {
  advanceBuildSession,
  planBuildSession,
  IDLE_SESSION,
  type BuildSessionEvent,
  type BuildSessionPlan,
  type BuildSessionState,
  type BuildSessionStep,
} from '@/lib/implementation-planner/build-session';
import { generatePlan, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import type { PlanDispatchResult } from '@/lib/implementation-planner/plan-dispatch';
import type { CallbackStatus } from '@/lib/cli-task';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';

/** `usePlanDispatch`'s onSettled signature. */
export type PlanSettled = (item: PlanItem, landed: boolean, callbackStatus?: CallbackStatus) => void;

interface UseBuildSessionOptions {
  /** The page's ONE plan dispatch door (`usePlanDispatch`). */
  dispatch: (item: PlanItem) => PlanDispatchResult;
  /** Whether that door's CLI session is running. */
  isRunning: boolean;
  /** Scope the proposal to one module. */
  moduleId?: string;
}

export interface UseBuildSessionResult {
  budgetMinutes: number;
  setBudgetMinutes: (minutes: number) => void;
  excluded: string[];
  toggleStep: (key: string) => void;
  /** The live sandbox proposal (recomputed on every budget/selection/status change). */
  proposal: BuildSessionPlan;
  run: BuildSessionState;
  canStart: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Wire into `usePlanDispatch({ onSettled })` — advances the run. */
  onSettled: PlanSettled;
}

const DEFAULT_BUDGET = 120;
const shortName = (key: string) => key.slice(key.indexOf('::') + 2);

/**
 * A budgeted build session over the plan's ONE dispatch door. Nothing dispatches
 * until `start()`; then one step at a time: a step is dispatched only once the
 * (refreshed) statuses show it ready, and the run advances only when that step's
 * callback confirms. A failure, an operator stop, a step that stays blocked
 * after the refresh, or a run that never starts all end in `stopped(reason)`.
 */
export function useBuildSession({ dispatch, isRunning, moduleId }: UseBuildSessionOptions): UseBuildSessionResult {
  const { statusMap } = useFeatureStatuses();
  const [budgetMinutes, setBudgetMinutes] = useState(DEFAULT_BUDGET);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [run, setRun] = useState<BuildSessionState>(IDLE_SESSION);
  const runRef = useRef(run);
  /** The step the reducer emitted and the door has not dispatched yet. */
  const pendingRef = useRef<BuildSessionStep | null>(null);
  /** The running state whose step was seen running on the CLI. */
  const startedRef = useRef<BuildSessionState | null>(null);

  const proposal = useMemo(
    () => planBuildSession(statusMap, { budgetMinutes, moduleId, exclude: excluded }),
    [statusMap, budgetMinutes, moduleId, excluded],
  );

  const apply = useCallback((event: BuildSessionEvent) => {
    const prev = runRef.current;
    const next = advanceBuildSession(prev, event);
    if (next.state === prev) return;
    runRef.current = next.state;
    pendingRef.current = next.emit;
    setRun(next.state);
    if (next.state.phase === 'done') logger.info(`[build-session] done: ${next.state.built} built`);
    if (next.state.phase === 'stopped') logger.info(`[build-session] stopped at ${next.state.reason}`);
  }, []);

  // Dispatch the emitted step once the statuses show it ready. On a confirmed
  // landing the door invalidates the shared cache BEFORE onSettled, so the next
  // step's item is re-read here from the refreshed statuses, never from onSettled.
  useEffect(() => {
    const step = pendingRef.current;
    if (!step || run.phase !== 'running') return;
    const item = generatePlan(statusMap).items.find((i) => i.key === step.key);
    if (item?.isReady) {
      pendingRef.current = null;
      dispatch(item); // the door's gate is readiness, so a ready item is never refused
      return;
    }
    const why = item ? `still blocked by ${item.unmetDeps.map(shortName).join(', ')}` : 'no longer in the plan';
    const timer = setTimeout(() => apply({ type: 'stop', why }), UI_TIMEOUTS.callbackSettleMax);
    return () => clearTimeout(timer);
  }, [run, statusMap, dispatch, apply]);

  // A dispatched step whose CLI run never starts (execute threw, terminal never
  // came up) must not leave the session hanging in 'running'.
  useEffect(() => {
    if (run.phase !== 'running' || pendingRef.current) return;
    if (isRunning) { startedRef.current = run; return; }
    if (startedRef.current === run) return;
    const timer = setTimeout(() => apply({ type: 'stop', why: 'run never started' }), UI_TIMEOUTS.callbackAwaitTimeout);
    return () => clearTimeout(timer);
  }, [run, isRunning, statusMap, apply]);

  const onSettled = useCallback<PlanSettled>((item, landed, callbackStatus) => {
    const current = runRef.current;
    if (current.phase !== 'running' || current.steps[current.index].key !== item.key) return;
    // landed === (success && 'confirmed'); a confirmed callback without a landing was a failed run.
    apply({ type: 'complete', success: landed || callbackStatus !== 'confirmed', callbackStatus });
  }, [apply]);

  const toggleStep = useCallback((key: string) => {
    setExcluded((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const canStart = run.phase !== 'running' && !isRunning && proposal.steps.length > 0;
  const start = useCallback(() => {
    if (canStart) apply({ type: 'start', steps: proposal.steps });
  }, [canStart, apply, proposal.steps]);
  const stop = useCallback(() => apply({ type: 'stop', why: 'stopped by you' }), [apply]);
  const reset = useCallback(() => apply({ type: 'reset' }), [apply]);

  return {
    budgetMinutes, setBudgetMinutes, excluded, toggleStep, proposal, run,
    canStart, start, stop, reset, onSettled,
  };
}
