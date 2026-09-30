/**
 * catalog-pipelines/B — the one-shot RUN PLAN: before 'Run pipeline' every step of the draft
 * says who will author it (the model, the step's built-in produce, a human art pick, or a
 * deferred runtime gate), and an operator override reaches only model-authorable steps.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { planRun, stepRefsFor, describeRunPlanTotals } from '@/lib/one-shot/runPlan';
import type { OrchestratorStepRef } from '@/lib/one-shot/runPlan';

const CHARACTERS: OrchestratorStepRef[] = stepRefsFor('characters');

describe('planRun', () => {
  it('characters with no overrides: 1 model / 7 built-in / 4 need art / 0 deferred; Behavior (NPC) is authorable but built-in', () => {
    expect(CHARACTERS).toHaveLength(12);
    const plan = planRun(CHARACTERS, {});
    expect(plan.totals).toEqual({ model: 1, builtIn: 7, needsArt: 4, deferred: 0 });
    const behavior = plan.rows.find((r) => r.label === 'Behavior (NPC)')!;
    expect(behavior).toMatchObject({ mode: 'run-deterministic', authorable: true });
    expect(describeRunPlanTotals(plan.totals)).toBe('1 model · 7 built-in · 4 need art · 0 deferred');
  });

  it('an override sends Behavior (NPC) to the model: 2 model / 6 built-in', () => {
    const plan = planRun(CHARACTERS, { 'Behavior (NPC)': 'cli' });
    expect(plan.totals.model).toBe(2);
    expect(plan.totals.builtIn).toBe(6);
    expect(plan.rows.find((r) => r.label === 'Behavior (NPC)')!.mode).toBe('run-cli');
  });

  it('a schema row is not authorable, and an override on it changes nothing', () => {
    const plan = planRun(CHARACTERS, { 'Stat Block': 'cli' });
    const stat = plan.rows.find((r) => r.label === 'Stat Block')!;
    expect(stat).toMatchObject({ mode: 'run-deterministic', authorable: false });
    expect(plan.totals).toEqual({ model: 1, builtIn: 7, needsArt: 4, deferred: 0 });
  });

  it('[guard] gallery rows stay needs-art even with a cli override', () => {
    const plan = planRun(CHARACTERS, { 'Concept 2D Art': 'cli' });
    expect(plan.rows.find((r) => r.label === 'Concept 2D Art')).toMatchObject({ mode: 'skip-needs-art', authorable: false });
  });
});
