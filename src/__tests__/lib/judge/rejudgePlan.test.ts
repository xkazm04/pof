import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rejudgePlan, judgeClassOf, planPriorKey, type PlanStep } from '@/lib/judge/rejudgePlan';
import type { PriorVerdict } from '@/lib/judge/fleetPlan';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { DeliverableClass } from '@/lib/judge/dimensions';

const step = (id: string, cls: DeliverableClass = 'text-config', data: Record<string, unknown> = { v: id }): PlanStep =>
  ({ catalogId: 'items', entityId: id, step: 'S', cls, data });
const prior = (s: PlanStep, over: Partial<PriorVerdict> = {}): [string, PriorVerdict] => [
  planPriorKey(s.catalogId, s.entityId, s.step, judgeClassOf(s.cls)),
  { judge: judgeClassOf(s.cls), verdict: 'pass', score: 80, contentHash: stepContentHash(s.data ?? {}), rubricVersion: 4, ...over },
];
const budget = (daily: number | null) => ({ dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: daily, monthlyRemainingUsd: null });

describe('rejudgePlan', () => {
  it('plans never-judged and changed steps; unchanged is skipped with its reason', () => {
    const never = step('a'), changed = step('b'), same = step('c');
    const priors = new Map([prior(changed, { contentHash: stepContentHash({ v: 'old' }) }), prior(same)]);
    const p = rejudgePlan({ steps: [never, changed, same], priors, rubricVersion: 4 });
    expect(p.entries.map((e) => [e.entityId, e.reason])).toEqual([
      ['a', 'never judged'],
      ['b', 'content changed since the verdict'],
    ]);
    expect(p.skipped).toHaveLength(1);
    expect(p.skipped[0]).toMatchObject({ entityId: 'c' });
    expect(p.skipped[0].reason).toMatch(/^unchanged since verdict PASS 80/);
  });

  it('buckets a prior under an older rubric as rubric', () => {
    const s = step('a');
    const p = rejudgePlan({ steps: [s], priors: new Map([prior(s, { rubricVersion: 3 })]), rubricVersion: 4 });
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ bucket: 'rubric', reason: 'verdict scored under rubric v3, now v4' });
  });

  it('prices per task type: 4 text-config x 0.40 + 6 2d-art x 1.20 = 8.80', () => {
    const steps = [
      ...Array.from({ length: 4 }, (_, i) => step(`t${i}`)),
      ...Array.from({ length: 6 }, (_, i) => step(`v${i}`, '2d-art')),
    ];
    const p = rejudgePlan({ steps, priors: new Map(), rubricVersion: 4, estimates: { 'judge-content': 0.4, 'judge-visual': 1.2 } });
    expect(p.estimatedUsd).toBeCloseTo(8.8, 6);
    expect(p.byTaskType['judge-content']).toEqual({ count: 4, estimatedUsd: 1.6, unestimated: 0 });
    expect(p.byTaskType['judge-visual']).toEqual({ count: 6, estimatedUsd: 7.2, unestimated: 0 });
    expect(p.totalIsFloor).toBe(false);
  });

  it('never prices a missing estimate at 0: counted unestimated, total is a floor', () => {
    const steps = [step('t'), step('v', '2d-art'), step('w', '2d-art')];
    const p = rejudgePlan({ steps, priors: new Map(), rubricVersion: 4, estimates: { 'judge-content': 0.4 } });
    expect(p.unestimated).toBe(2);
    expect(p.totalIsFloor).toBe(true);
    expect(p.estimatedUsd).toBeCloseTo(0.4, 6);
    expect(p.byTaskType['judge-visual']).toMatchObject({ count: 2, unestimated: 2 });
    expect(p.entries.filter((e) => e.taskType === 'judge-visual').every((e) => e.estimateUsd === null)).toBe(true);
  });

  it('cuts the priority-ordered plan at the budget ceiling', () => {
    const steps = ['a', 'b', 'c', 'd'].map((id) => step(id, '2d-art'));
    const p = rejudgePlan({ steps, priors: new Map(), rubricVersion: 4, estimates: { 'judge-visual': 1.2 }, budget: budget(3.0) });
    expect(p.ceilingUsd).toBe(3);
    expect(p.fitsBudget.map((e) => e.entityId)).toEqual(['a', 'b']);
    expect(p.overBudget.map((e) => e.entityId)).toEqual(['c', 'd']);
    expect(p.fitsUsd).toBeCloseTo(2.4, 6);
  });

  it('with no budget configured everything fits and the ceiling is null', () => {
    const p = rejudgePlan({ steps: [step('a')], priors: new Map(), rubricVersion: 4, estimates: { 'judge-content': 0.4 } });
    expect(p.ceilingUsd).toBeNull();
    expect(p.fitsBudget).toHaveLength(1);
    expect(p.overBudget).toHaveLength(0);
  });

  it('an unpriced entry cannot be proven affordable and ends the prefix', () => {
    const p = rejudgePlan({
      steps: [step('a', '2d-art'), step('b')], priors: new Map(), rubricVersion: 4,
      estimates: { 'judge-content': 0.4 }, budget: budget(10),
    });
    expect(p.fitsBudget).toHaveLength(0);
    expect(p.overBudget).toHaveLength(2);
  });

  it('orders failed-on-changed-content, then never judged, then content changed, then rubric', () => {
    const rubricPass = step('rubric'), never = step('never'), failChanged = step('failed'), passChanged = step('passed');
    const priors = new Map([
      prior(rubricPass, { rubricVersion: 3 }),
      prior(failChanged, { verdict: 'fail', score: 40, contentHash: stepContentHash({ v: 'old' }) }),
      prior(passChanged, { contentHash: stepContentHash({ v: 'old' }) }),
    ]);
    const p = rejudgePlan({ steps: [rubricPass, never, passChanged, failChanged], priors, rubricVersion: 4 });
    expect(p.entries.map((e) => e.entityId)).toEqual(['failed', 'never', 'passed', 'rubric']);
  });

  it('force plans every judgeable step as forced', () => {
    const a = step('a'), b = step('b');
    const p = rejudgePlan({ steps: [a, b], priors: new Map([prior(a), prior(b)]), rubricVersion: 4, force: true });
    expect(p.skipped).toHaveLength(0);
    expect(p.entries).toHaveLength(2);
    expect(p.entries.every((e) => e.bucket === 'forced' && e.reason.startsWith('forced re-judge'))).toBe(true);
  });
});

describe('judgeClassOf — one definition, so the ?plan=1 preview and the run key priors alike', () => {
  const ROOT = process.cwd();
  const PREDICATE = /'text-config'\s*\?\s*'llm-panel'/g;
  const count = (rel: string) => (readFileSync(join(ROOT, rel), 'utf8').match(PREDICATE) ?? []).length;

  it('the deliverable-class -> judge-class predicate is written once, and judge-run imports it', () => {
    expect(count('src/lib/judge/rejudgePlan.ts')).toBe(1);
    expect(count('scripts/judge-run.ts')).toBe(0);
    expect(readFileSync(join(ROOT, 'scripts/judge-run.ts'), 'utf8')).toContain("import { judgeClassOf } from '../src/lib/judge/rejudgePlan'");
  });

  it('maps text-config to the panel and everything else to the vision judge', () => {
    expect(judgeClassOf('text-config')).toBe('llm-panel');
    expect(judgeClassOf('image' as DeliverableClass)).toBe('vlm');
  });
});
