'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import type { GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';
import type { StepModeOverride, StepModeOverrides } from '@/lib/one-shot/runPlan';

/**
 * `analyzed` is a RESTING phase: the distribution is on screen and the operator picks the gap
 * to fill (or proposes without one) — no LLM run is spawned until they do.
 */
export type OneShotPhase =
  | 'idle' | 'analyzing' | 'analyzed' | 'proposing' | 'refining' | 'awaitingRun'
  | 'running' | 'completed' | 'failed';

export type StepOutcome = 'pass' | 'fail' | 'skipped' | 'deferred';

export interface StepResult { step: string; outcome: StepOutcome; reason?: string }

export interface OneShotProposal { name: string; data: unknown; rationale: string }

export interface OneShotSummary { ran: number; passed: number; failed: number; skipped: number; deferred: number }

export interface OneShotJobState {
  jobId: string | null;
  phase: OneShotPhase;
  catalogId: string | null;
  draftEntityId: string | null;
  userHint?: string;
  proposal: OneShotProposal | null;
  refinementTurns: number;
  currentStepIndex: number;
  stepResults: StepResult[];
  lastSummary: OneShotSummary | null;
  failureReason?: string;
  distribution: CatalogDistribution | null;
  /** The gap the current proposal is aimed at; `null` = the model picked (or no basis). */
  target: GapTarget | null;
  totalSteps: number;
  /**
   * The run plan's per-step author choices (label → 'cli' | 'deterministic'); absent = the step's
   * default. Read by every run path (run / resume / retry); cleared by `reset` (a new analyze).
   */
  stepModeOverrides: StepModeOverrides;

  // actions
  reset: () => void;
  setPhase: (
    p: OneShotPhase,
    patch?: Partial<Pick<OneShotJobState, 'catalogId' | 'jobId' | 'draftEntityId' | 'userHint' | 'failureReason'>>,
  ) => void;
  setProposal: (p: OneShotProposal | null) => void;
  setDistribution: (d: CatalogDistribution | null) => void;
  setTarget: (t: GapTarget | null) => void;
  setTotalSteps: (n: number) => void;
  /** Choose who authors `label` in the run plan; `null` returns it to its default. */
  setStepMode: (label: string, mode: StepModeOverride | null) => void;
  incRefinementTurn: (forceMore: boolean) => boolean;
  recordStep: (r: StepResult) => void;
  /** Replace the recorded outcome of `r.step` in place (append if unseen) — a retry keeps run order. */
  upsertStep: (r: StepResult) => void;
  summarize: () => OneShotSummary;
  canStart: () => boolean;
  markCompleted: () => void;
}

const REFINEMENT_TURN_CAP = 3;

const INITIAL: Pick<
  OneShotJobState,
  'jobId' | 'phase' | 'catalogId' | 'draftEntityId' | 'proposal' | 'refinementTurns' | 'currentStepIndex' | 'stepResults' | 'lastSummary' | 'distribution' | 'target' | 'totalSteps' | 'stepModeOverrides'
> = {
  jobId: null,
  phase: 'idle',
  catalogId: null,
  draftEntityId: null,
  proposal: null,
  refinementTurns: 0,
  currentStepIndex: 0,
  stepResults: [],
  lastSummary: null,
  distribution: null,
  target: null,
  totalSteps: 0,
  stepModeOverrides: {},
};

const IN_FLIGHT: readonly OneShotPhase[] = ['analyzing', 'proposing', 'refining', 'awaitingRun', 'running'];

/**
 * No request survives a reload, so no in-flight phase may either: each rehydrates to the resting
 * phase its persisted data can still support — an unanswered proposal/refine rests at the
 * proposal it had (or the distribution), a run or an analyze with nothing to rest on is
 * `failed` / `reload-interrupted` (a run keeps its draft + recorded steps for resume).
 */
function restingAfterReload(p: Partial<OneShotJobState>): Pick<OneShotJobState, 'phase' | 'failureReason'> {
  const phase = p.phase ?? 'idle';
  // A resting `analyzed` is only meaningful with the distribution the operator picks from.
  if (phase === 'analyzed' && !p.distribution) return { phase: 'idle', failureReason: p.failureReason };
  if (!IN_FLIGHT.includes(phase)) return { phase, failureReason: p.failureReason };
  const interrupted = 'reload-interrupted';
  if (phase !== 'running' && phase !== 'analyzing') {
    if (p.proposal && p.distribution) return { phase: 'proposing', failureReason: p.failureReason };
    if (p.distribution) return { phase: 'analyzed', failureReason: interrupted };
  }
  return { phase: 'failed', failureReason: interrupted };
}

export const useOneShotJobStore = create<OneShotJobState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      reset: () => set({ ...INITIAL, failureReason: undefined, userHint: undefined }),
      setPhase: (phase, patch) => set({ phase, ...(patch ?? {}) }),
      setProposal: (proposal) => set({ proposal }),
      setDistribution: (distribution) => set({ distribution }),
      setTarget: (target) => set({ target }),
      setTotalSteps: (totalSteps) => set({ totalSteps }),
      setStepMode: (label, mode) =>
        set((s) => {
          const next = { ...s.stepModeOverrides };
          if (mode) next[label] = mode; else delete next[label];
          return { stepModeOverrides: next };
        }),
      incRefinementTurn: (forceMore) => {
        const cur = get().refinementTurns;
        if (cur >= REFINEMENT_TURN_CAP && !forceMore) return false;
        set({ refinementTurns: cur + 1 });
        return true;
      },
      recordStep: (r) =>
        set((s) => ({ stepResults: [...s.stepResults, r], currentStepIndex: s.stepResults.length + 1 })),
      upsertStep: (r) =>
        set((s) => {
          const i = s.stepResults.findIndex((x) => x.step === r.step);
          if (i < 0) return { stepResults: [...s.stepResults, r], currentStepIndex: s.stepResults.length + 1 };
          return { stepResults: s.stepResults.map((x, j) => (j === i ? r : x)) };
        }),
      summarize: () => {
        const r = get().stepResults;
        return {
          ran:      r.filter((x) => x.outcome === 'pass' || x.outcome === 'fail').length,
          passed:   r.filter((x) => x.outcome === 'pass').length,
          failed:   r.filter((x) => x.outcome === 'fail').length,
          skipped:  r.filter((x) => x.outcome === 'skipped').length,
          deferred: r.filter((x) => x.outcome === 'deferred').length,
        };
      },
      // `analyzed` is at rest (nothing in flight), so another catalog may be analyzed from it.
      canStart: () => ['idle', 'analyzed', 'completed', 'failed'].includes(get().phase),
      markCompleted: () => set({ phase: 'completed', lastSummary: get().summarize() }),
    }),
    {
      name: 'pof-one-shot-job',
      merge: (persisted, current) => {
        const p = (persisted as Partial<OneShotJobState> | null | undefined) ?? {};
        return { ...current, ...p, ...restingAfterReload(p) };
      },
    },
  ),
);
