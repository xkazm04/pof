import { describe, it, expect } from 'vitest';
import {
  emptyBatchSummary,
  foldEntityOutcome,
  type DrainOutcome,
} from '@/components/layout-lab/batchDrainModel';
import type { DrainSummary } from '@/lib/test-gate-runner/types';

const failResult = (step: string, reason: string) => ({
  job: { catalogId: 'c', entityId: 'e', step, tier: 'L3' as const },
  verdict: { status: 'fail' as const, detail: reason },
});
const passResult = (step: string) => ({
  job: { catalogId: 'c', entityId: 'e', step, tier: 'L3' as const },
  verdict: { status: 'pass' as const, detail: 'ok' },
});
const okOutcome = (over: Partial<DrainSummary> = {}): DrainOutcome => ({
  kind: 'ok',
  summary: { ran: 0, passed: 0, failed: 0, skipped: 0, screenshots: [], results: [], ...over },
});

describe('foldEntityOutcome — batch summary derivation', () => {
  it('accumulates the runner counts across entities', () => {
    const acc = emptyBatchSummary();
    foldEntityOutcome(acc, 'e1', 'One', okOutcome({ ran: 2, passed: 2, results: [passResult('A'), passResult('B')] }));
    foldEntityOutcome(acc, 'e2', 'Two', okOutcome({ ran: 1, failed: 1, results: [failResult('C', 'out of band')] }));
    expect(acc.entitiesRun).toBe(2);
    expect(acc.ran).toBe(3);
    expect(acc.passed).toBe(2);
    expect(acc.failed).toBe(1);
  });

  it('collects per-step fail reasons with the entity + checker detail (no silent fails)', () => {
    const acc = emptyBatchSummary();
    foldEntityOutcome(acc, 'e2', 'Two', okOutcome({ failed: 1, results: [failResult('Economy Gate', 'price/power 1.43x')] }));
    expect(acc.fails).toEqual([{ entityId: 'e2', entityName: 'Two', step: 'Economy Gate', reason: 'price/power 1.43x' }]);
  });

  it('counts a locked entity without folding any flips', () => {
    const acc = emptyBatchSummary();
    foldEntityOutcome(acc, 'e1', 'One', { kind: 'locked' });
    expect(acc).toMatchObject({ entitiesLocked: 1, entitiesRun: 0, passed: 0, failed: 0 });
  });

  it('counts an errored entity separately', () => {
    const acc = emptyBatchSummary();
    foldEntityOutcome(acc, 'e1', 'One', { kind: 'error', reason: 'Network error' });
    expect(acc).toMatchObject({ entitiesErrored: 1, entitiesRun: 0 });
  });
});
