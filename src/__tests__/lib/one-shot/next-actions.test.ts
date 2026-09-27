/** image-generation/B — every one-shot phase exposes at least one forward action. */
import { describe, it, expect } from 'vitest';
import { nextActions } from '@/lib/one-shot/next-actions';
import type { OneShotPhase, StepResult } from '@/stores/oneShotJobStore';

const pass = (step: string): StepResult => ({ step, outcome: 'pass' });

describe('nextActions', () => {
  it('idle -> start', () => {
    expect(nextActions({ phase: 'idle' })).toEqual(['start']);
  });

  it('every in-flight phase offers cancel', () => {
    for (const phase of ['analyzing', 'proposing', 'refining', 'awaitingRun', 'running'] as OneShotPhase[]) {
      expect(nextActions({ phase })).toContain('cancel');
    }
  });

  it('completed with every step passing -> startOver, never retryFailed', () => {
    const a = nextActions({ phase: 'completed', draftEntityId: 'd', stepResults: [pass('A'), pass('B')], totalSteps: 2 });
    expect(a).toContain('startOver');
    expect(a).not.toContain('retryFailed');
    expect(a).not.toContain('resume');
  });

  it('completed with a failed step -> retryFailed + startOver', () => {
    const a = nextActions({ phase: 'completed', draftEntityId: 'd', stepResults: [pass('A'), { step: 'B', outcome: 'fail' }], totalSteps: 2 });
    expect(a).toEqual(expect.arrayContaining(['retryFailed', 'startOver']));
  });

  it('failed after reload with a draft and 2 of 5 recorded -> resume + startOver', () => {
    const a = nextActions({
      phase: 'failed', failureReason: 'reload-interrupted', draftEntityId: 'draft-items-1',
      stepResults: [pass('Brief'), pass('Attributes')], totalSteps: 5,
    });
    expect(a).toEqual(expect.arrayContaining(['resume', 'startOver']));
  });

  it('failed before any draft existed -> startOver only (nothing to resume)', () => {
    expect(nextActions({ phase: 'failed', failureReason: 'reload-interrupted', draftEntityId: null })).toEqual(['startOver']);
  });

  it('every phase has at least one action', () => {
    const all: OneShotPhase[] = ['idle', 'analyzing', 'analyzed', 'proposing', 'refining', 'awaitingRun', 'running', 'completed', 'failed'];
    for (const phase of all) expect(nextActions({ phase }).length).toBeGreaterThan(0);
  });
});
