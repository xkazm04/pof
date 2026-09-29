import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepsForProfile } from '@/lib/catalog/stepScope';
import { isCliEligible } from '@/lib/catalog/cliEligibility';
import { decide } from './skip-policy';
import type { ArchetypeId, ViewDescriptor, AcceptanceTier, SkipDecision } from './types';

/**
 * The one-shot RUN PLAN — who authors each step of a draft, decided BEFORE 'Run pipeline' so
 * the spend is disclosed and amendable instead of learned from the run log afterwards.
 *
 * `decideStep` is the one place a step's mode is resolved: the plan renders it and the
 * orchestrator's `runStep` dispatches with it, so what the operator saw is what runs.
 */

export interface OrchestratorStepRef {
  label: string;
  archetype: ArchetypeId;
  tier: AcceptanceTier;
  view: ViewDescriptor;
  autoMode?: 'cli' | 'deterministic' | 'skip';
}

/** The operator's per-step author choice, keyed by step label (absent = the default). */
export type StepModeOverride = 'cli' | 'deterministic';
export type StepModeOverrides = Readonly<Record<string, StepModeOverride>>;

export interface RunPlanRow {
  label: string;
  archetype: ArchetypeId;
  tier: AcceptanceTier;
  mode: SkipDecision['mode'];
  /** May a model author this step (the lab's `isCliEligible`, not tier-deferred or art)? */
  authorable: boolean;
}

export interface RunPlanTotals { model: number; builtIn: number; needsArt: number; deferred: number }
export interface RunPlan { rows: RunPlanRow[]; totals: RunPlanTotals }

/** A catalog's registered, profile-scoped steps as orchestrator refs (empty when unregistered). */
export function stepRefsFor(catalogId: string): OrchestratorStepRef[] {
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) return [];
  // One-shot drafts are the project's own entities: steps scoped to other canon profiles are not theirs (D18).
  return stepsForProfile(pipeline).map((s) => {
    const res = s.accept ? s.accept({}) : { tier: 'L0' as const };
    return { label: s.label, archetype: s.archetype, tier: (res?.tier ?? 'L0') as AcceptanceTier, view: s.view };
  });
}

/** Resolve one step's mode: an override counts only for a model-authorable archetype. */
export function decideStep(s: OrchestratorStepRef, overrides: StepModeOverrides = {}): SkipDecision {
  const override = isCliEligible(s.archetype) ? overrides[s.label] : undefined;
  return decide(s.archetype, s.tier, s.view, { autoMode: override ?? s.autoMode });
}

/** Pure: every step's author + the totals the plan and the Run button disclose. */
export function planRun(steps: readonly OrchestratorStepRef[], overrides: StepModeOverrides = {}): RunPlan {
  const totals: RunPlanTotals = { model: 0, builtIn: 0, needsArt: 0, deferred: 0 };
  const rows = steps.map((s): RunPlanRow => {
    const { mode } = decideStep(s, overrides);
    if (mode === 'run-cli') totals.model++;
    else if (mode === 'run-deterministic') totals.builtIn++;
    else if (mode === 'skip-needs-art') totals.needsArt++;
    else totals.deferred++;
    const runnable = mode === 'run-cli' || mode === 'run-deterministic';
    return { label: s.label, archetype: s.archetype, tier: s.tier, mode, authorable: runnable && isCliEligible(s.archetype) };
  });
  return { rows, totals };
}

export function describeRunPlanTotals(t: RunPlanTotals): string {
  return `${t.model} model · ${t.builtIn} built-in · ${t.needsArt} need art · ${t.deferred} deferred`;
}
