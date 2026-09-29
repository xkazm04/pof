/**
 * Build session — turn a time budget into a dependency-safe run of plan items.
 *
 * `planBuildSession` is the sandbox: it proposes steps greedily by impact per
 * estimated minute among READY features, re-evaluating readiness after every
 * pick with the ONE done rule (`isFeatureDone`), so a feature unlocked by an
 * earlier step becomes eligible inside the same session. Deselecting a step
 * (`exclude`) removes it and — because readiness is re-derived, not remembered —
 * everything that waited on it. The projection is RECOMPUTED over the
 * hypothetical statuses, never summed from per-step deltas.
 *
 * `advanceBuildSession` is the run reducer (idle -> running(i) -> done |
 * stopped(reason)): it advances only on a confirmed landing and emits the next
 * step for dispatch; anything else stops the run and names the step and why.
 *
 * Minutes are `estimateEffort` buckets (15/30/60/120) — estimates, not measured
 * CLI time. Pure and deterministic.
 */

import { buildDependencyMap } from '@/lib/feature-definitions';
import { isFeatureDone } from '@/lib/constellation/layout';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import type { CallbackStatus } from '@/lib/cli-task';
import { computeImpactScores } from './impact-scorer';
import { estimateEffort, formatEffortTime } from './effort-estimator';

export interface BuildSessionStep {
  key: string;
  moduleId: SubModuleId;
  featureName: string;
  /** Estimated minutes (`estimateEffort`). */
  minutes: number;
  /** The earlier step whose landing makes this one ready; absent when ready now. */
  unlockedBy?: string;
}

export interface BuildSessionProjection {
  /** Ready (not done, every prerequisite done) features today. */
  readyBefore: number;
  /** Ready features once every step has landed — recomputed, not summed. */
  readyAfter: number;
  /** Done features once every step has landed. */
  doneAfter: number;
}

export interface BuildSessionPlan {
  steps: BuildSessionStep[];
  totalMinutes: number;
  projected: BuildSessionProjection;
  /** Why `steps` is empty; null when there are steps. */
  emptyReason: string | null;
}

export interface BuildSessionOptions {
  budgetMinutes: number;
  /** Restrict steps (and the projection) to one module. */
  moduleId?: string;
  /** Keys the operator deselected. */
  exclude?: readonly string[];
}

const moduleOf = (key: string) => key.slice(0, key.indexOf('::'));

function readinessCounts(keys: readonly string[], done: (key: string) => boolean) {
  const depMap = buildDependencyMap();
  let ready = 0;
  let doneCount = 0;
  for (const key of keys) {
    if (done(key)) doneCount++;
    else if ((depMap.get(key)?.deps ?? []).every((d) => done(d.key))) ready++;
  }
  return { ready, done: doneCount };
}

export function planBuildSession(
  statusMap: ReadonlyMap<string, string>,
  opts: BuildSessionOptions,
): BuildSessionPlan {
  const depMap = buildDependencyMap();
  const keys = [...depMap.keys()].filter((k) => !opts.moduleId || moduleOf(k) === opts.moduleId);
  const doneNow = (k: string) => isFeatureDone((statusMap.get(k) ?? 'unknown') as FeatureStatus);
  const picked = new Set<string>();
  const doneAfter = (k: string) => picked.has(k) || doneNow(k);
  const excluded = new Set(opts.exclude ?? []);
  const impact = computeImpactScores(new Set([...depMap.keys()].filter(doneNow)));
  const minutesOf = new Map(keys.map((k) => [k, estimateEffort(moduleOf(k) as SubModuleId, k.slice(k.indexOf('::') + 2)).minutes]));

  const isReady = (k: string) => !doneAfter(k) && (depMap.get(k)?.deps ?? []).every((d) => doneAfter(d.key));
  const steps: BuildSessionStep[] = [];
  let remaining = Math.max(0, opts.budgetMinutes);
  for (;;) {
    let best: { key: string; ratio: number } | null = null;
    for (const key of keys) {
      if (excluded.has(key) || !isReady(key) || minutesOf.get(key)! > remaining) continue;
      const ratio = (impact.get(key)?.score ?? 0) / minutesOf.get(key)!;
      if (!best || ratio > best.ratio || (ratio === best.ratio && key < best.key)) best = { key, ratio };
    }
    if (!best) break;
    const key = best.key;
    // The prerequisite landed latest inside the session is the one that unlocked it.
    const unlockers = (depMap.get(key)?.deps ?? []).map((d) => d.key).filter((d) => picked.has(d));
    const unlockedBy = steps.map((s) => s.key).filter((k) => unlockers.includes(k)).pop();
    picked.add(key);
    remaining -= minutesOf.get(key)!;
    steps.push({
      key,
      moduleId: moduleOf(key) as SubModuleId,
      featureName: key.slice(key.indexOf('::') + 2),
      minutes: minutesOf.get(key)!,
      ...(unlockedBy ? { unlockedBy } : {}),
    });
  }

  const before = readinessCounts(keys, doneNow);
  const after = readinessCounts(keys, doneAfter);
  return {
    steps,
    totalMinutes: steps.reduce((sum, s) => sum + s.minutes, 0),
    projected: { readyBefore: before.ready, readyAfter: after.ready, doneAfter: after.done },
    emptyReason: steps.length > 0 ? null : emptyReason(keys, excluded, doneNow, isReady, minutesOf),
  };
}

function emptyReason(
  keys: readonly string[],
  excluded: ReadonlySet<string>,
  done: (k: string) => boolean,
  isReady: (k: string) => boolean,
  minutesOf: ReadonlyMap<string, number>,
): string {
  if (keys.every(done)) return 'Every feature in scope is done';
  const ready = keys.filter((k) => isReady(k) && !excluded.has(k));
  if (ready.length === 0) return 'Nothing in scope is ready to build';
  const cheapest = Math.min(...ready.map((k) => minutesOf.get(k)!));
  return `Budget is below the cheapest ready task (${formatEffortTime(cheapest)})`;
}

// ---------- Run reducer ----------

export type BuildSessionState =
  | { phase: 'idle' }
  | { phase: 'running'; index: number; steps: BuildSessionStep[] }
  | { phase: 'done'; built: number; steps: BuildSessionStep[] }
  | { phase: 'stopped'; index: number; steps: BuildSessionStep[]; reason: string };

export type BuildSessionEvent =
  | { type: 'start'; steps: BuildSessionStep[] }
  | { type: 'complete'; success: boolean; callbackStatus?: CallbackStatus }
  /** The run cannot continue for a reason outside the CLI outcome (operator stop, stall, refusal). */
  | { type: 'stop'; why: string }
  | { type: 'reset' };

export interface BuildSessionTransition {
  state: BuildSessionState;
  /** The step to dispatch now, or null. */
  emit: BuildSessionStep | null;
}

export const IDLE_SESSION: BuildSessionState = { phase: 'idle' };

export function advanceBuildSession(state: BuildSessionState, event: BuildSessionEvent): BuildSessionTransition {
  const stay = { state, emit: null };
  switch (event.type) {
    case 'reset':
      return state.phase === 'running' ? stay : { state: IDLE_SESSION, emit: null };
    case 'start':
      if (state.phase === 'running' || event.steps.length === 0) return stay;
      return { state: { phase: 'running', index: 0, steps: event.steps }, emit: event.steps[0] };
    case 'stop':
      if (state.phase !== 'running') return stay;
      return {
        state: { ...state, phase: 'stopped', reason: `${state.steps[state.index].featureName}: ${event.why}` },
        emit: null,
      };
    case 'complete': {
      if (state.phase !== 'running') return stay;
      const { index, steps } = state;
      if (!event.success || event.callbackStatus !== 'confirmed') {
        const why = !event.success ? 'run failed' : `callback ${event.callbackStatus ?? 'missing'}`;
        return { state: { phase: 'stopped', index, steps, reason: `${steps[index].featureName}: ${why}` }, emit: null };
      }
      if (index + 1 >= steps.length) return { state: { phase: 'done', built: steps.length, steps }, emit: null };
      return { state: { phase: 'running', index: index + 1, steps }, emit: steps[index + 1] };
    }
  }
}
