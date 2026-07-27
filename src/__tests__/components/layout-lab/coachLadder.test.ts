import { describe, it, expect } from 'vitest';

import { COACH_LADDER, COACH_PRIORITY_RANK, pickLadderIssue } from '@/components/layout-lab/coachLadder';
import { pickEntityIssue } from '@/components/layout-lab/globalCoachModel';
import { pickNextActionableStep } from '@/components/layout-lab/nextActionableStep';
import type { StepDisplayStatus, StepDrift } from '@/components/layout-lab/hooks/useEntityArtifacts';

const steps = ['A', 'B', 'C', 'D'];
const statuses = (list: StepDisplayStatus[]) => (_s: string, i: number) => list[i];
const drift = (step: string) => new Map<string, StepDrift>([[step, { local: 'pass', server: 'fail' }]]);
const noDrift = new Map<string, StepDrift>();

describe('coachLadder — the ONE documented priority order', () => {
  it('is fail > drift > pending > deferred > unproduced', () => {
    expect(COACH_LADDER).toEqual(['fail', 'drift', 'pending', 'deferred', 'unproduced']);
    expect(COACH_PRIORITY_RANK).toEqual({ fail: 0, drift: 1, pending: 2, deferred: 3, unproduced: 4 });
  });

  it('picks each rung in order, and the FIRST step by pipeline index within a rung', () => {
    expect(pickLadderIssue(steps, statuses(['pass', 'deferred', 'fail', 'pending']), drift('A')))
      .toEqual({ step: 'C', index: 2, priority: 'fail' });
    expect(pickLadderIssue(steps, statuses(['pass', 'pending', 'deferred', 'pass']), drift('C')))
      .toEqual({ step: 'C', index: 2, priority: 'drift' });
    expect(pickLadderIssue(steps, statuses(['pass', 'deferred', 'pending', 'pending']), noDrift))
      .toEqual({ step: 'C', index: 2, priority: 'pending' });
    expect(pickLadderIssue(steps, statuses(['pass', 'unproduced', 'deferred', 'deferred']), noDrift))
      .toEqual({ step: 'C', index: 2, priority: 'deferred' });
    expect(pickLadderIssue(steps, statuses(['pass', 'unproduced', 'pass', 'unproduced']), noDrift))
      .toEqual({ step: 'B', index: 1, priority: 'unproduced' });
  });

  it('returns null when nothing is actionable', () => {
    expect(pickLadderIssue(steps, statuses(['pass', 'pass', 'pass', 'pass']), noDrift)).toBeNull();
  });

  it('treats an absent drift map as an empty drift rung (never throws)', () => {
    expect(pickLadderIssue(steps, statuses(['pass', 'pending', 'pass', 'pass']))).toEqual({ step: 'B', index: 1, priority: 'pending' });
  });
});

describe('the two coaches agree', () => {
  // Same entity, same derived statuses → both coaches must name the SAME step. Before
  // the unified ladder these two functions disagreed on drift and on pending-vs-unproduced.
  const cases: StepDisplayStatus[][] = [
    ['pass', 'unproduced', 'pending', 'deferred'],
    ['unproduced', 'deferred', 'pass', 'pass'],
    ['pass', 'pass', 'deferred', 'unproduced'],
    ['fail', 'pending', 'unproduced', 'deferred'],
  ];

  it.each(cases)('names one step for [%s, %s, %s, %s]', (...list) => {
    const by = statuses(list as StepDisplayStatus[]);
    const global = pickEntityIssue(steps, by, noDrift);
    const entity = pickNextActionableStep(steps, by, noDrift);
    expect(entity?.step).toBe(global?.step);
    expect(entity?.priority).toBe(global?.priority);
  });

  it('agrees on a drifted step too — the per-entity coach now has a drift rung', () => {
    const by = statuses(['pass', 'pass', 'unproduced', 'pass'] as StepDisplayStatus[]);
    const d = drift('B');
    expect(pickEntityIssue(steps, by, d)?.step).toBe('B');
    const entity = pickNextActionableStep(steps, by, d);
    expect(entity?.step).toBe('B');
    expect(entity?.priority).toBe('drift');
    expect(entity?.actionWord).toBe('Review');
  });
});
