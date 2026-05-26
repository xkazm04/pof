'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OneShotPhase =
  | 'idle' | 'analyzing' | 'proposing' | 'refining' | 'awaitingRun'
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

  // actions
  reset: () => void;
  setPhase: (
    p: OneShotPhase,
    patch?: Partial<Pick<OneShotJobState, 'catalogId' | 'jobId' | 'draftEntityId' | 'userHint' | 'failureReason'>>,
  ) => void;
  setProposal: (p: OneShotProposal | null) => void;
  incRefinementTurn: (forceMore: boolean) => boolean;
  recordStep: (r: StepResult) => void;
  summarize: () => OneShotSummary;
  canStart: () => boolean;
  markCompleted: () => void;
}

const REFINEMENT_TURN_CAP = 3;

const INITIAL: Pick<
  OneShotJobState,
  'jobId' | 'phase' | 'catalogId' | 'draftEntityId' | 'proposal' | 'refinementTurns' | 'currentStepIndex' | 'stepResults' | 'lastSummary'
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
};

export const useOneShotJobStore = create<OneShotJobState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      reset: () => set({ ...INITIAL, failureReason: undefined, userHint: undefined }),
      setPhase: (phase, patch) => set({ phase, ...(patch ?? {}) }),
      setProposal: (proposal) => set({ proposal }),
      incRefinementTurn: (forceMore) => {
        const cur = get().refinementTurns;
        if (cur >= REFINEMENT_TURN_CAP && !forceMore) return false;
        set({ refinementTurns: cur + 1 });
        return true;
      },
      recordStep: (r) =>
        set((s) => ({ stepResults: [...s.stepResults, r], currentStepIndex: s.stepResults.length + 1 })),
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
      canStart: () => ['idle', 'completed', 'failed'].includes(get().phase),
      markCompleted: () => set({ phase: 'completed', lastSummary: get().summarize() }),
    }),
    {
      name: 'pof-one-shot-job',
      merge: (persisted, current) => {
        const p = (persisted as Partial<OneShotJobState> | null | undefined) ?? {};
        const phase: OneShotPhase = p.phase === 'running' ? 'failed' : (p.phase ?? 'idle');
        const failureReason = p.phase === 'running' ? 'reload-interrupted' : p.failureReason;
        return { ...current, ...p, phase, failureReason };
      },
    },
  ),
);
