import { describe, it, expect } from 'vitest';

import { COACH_HINT, COACH_LADDER, COACH_PRIORITY_RANK, pickLadderIssue } from '@/components/layout-lab/coachLadder';
import { pickEntityIssue } from '@/components/layout-lab/globalCoachModel';
import { pickNextActionableStep } from '@/components/layout-lab/nextActionableStep';
import type { StepDisplayStatus, StepDrift } from '@/components/layout-lab/hooks/useEntityArtifacts';

const steps = ['A', 'B', 'C', 'D'];
const statuses = (list: StepDisplayStatus[]) => (_s: string, i: number) => list[i];
const drift = (step: string) => new Map<string, StepDrift>([[step, { kind: 'status', local: 'pass', server: 'fail' }]]);
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

describe('one verb per rung across both coaches', () => {
  // The step under test sits at index 1 (index 0 keeps the declared "Start here" variant).
  const by = (status: StepDisplayStatus) => statuses(['pass', status, 'pass', 'pass']);
  const rungs: Array<[string, StepDisplayStatus]> = [
    ['fail', 'fail'], ['pending', 'pending'], ['deferred', 'deferred'], ['unproduced', 'unproduced'],
  ];

  it.each(rungs)('NextStepCoach names the %s rung with COACH_HINT.actionWord', (priority, status) => {
    const next = pickNextActionableStep(steps, by(status), noDrift);
    expect(next?.actionWord).toBe(COACH_HINT[priority as keyof typeof COACH_HINT].actionWord);
  });

  it('names the drift rung with COACH_HINT.actionWord', () => {
    expect(pickNextActionableStep(steps, by('pass'), drift('B'))?.actionWord).toBe(COACH_HINT.drift.actionWord);
  });

  it('keeps "Start here" for an index-0 step that is not yet finished', () => {
    expect(pickNextActionableStep(steps, statuses(['unproduced', 'pass', 'pass', 'pass']), noDrift)?.actionWord).toBe('Start here');
    expect(pickNextActionableStep(steps, statuses(['pending', 'pass', 'pass', 'pass']), noDrift)?.actionWord).toBe('Start here');
  });

  it('describes pending as held (acceptance names what is missing), not as resolving', () => {
    const hint = pickNextActionableStep(steps, by('pending'), noDrift)?.plainHint ?? '';
    expect(hint).toMatch(/held/);
    expect(hint).not.toMatch(/resolving/);
  });
});
