import { describe, it, expect } from 'vitest';
import {
  emptyBatchSummary,
  summarizeBatchDrain,
  type DrainOutcome,
  type BatchEntityRef,
} from '@/components/layout-lab/batchDrainModel';
import type { DrainSummary } from '@/lib/test-gate-runner/types';

const failResult = (entityId: string, step: string, reason: string) => ({
  job: { catalogId: 'c', entityId, step, tier: 'L3' as const },
  verdict: { status: 'fail' as const, detail: reason },
});
const passResult = (entityId: string, step: string) => ({
  job: { catalogId: 'c', entityId, step, tier: 'L3' as const },
  verdict: { status: 'pass' as const, detail: 'ok' },
});
const okOutcome = (over: Partial<DrainSummary> = {}): DrainOutcome => ({
  kind: 'ok',
  summary: { ran: 0, passed: 0, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [], ...over },
});
const entities: BatchEntityRef[] = [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }];

describe('summarizeBatchDrain — derives the catalog-wide summary from ONE batch outcome', () => {
  it('carries the aggregate runner counts and groups results back to their entities', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      ran: 3, passed: 2, failed: 1,
      results: [passResult('e1', 'A'), passResult('e1', 'B'), failResult('e2', 'C', 'out of band')],
    }));
    expect(acc.ran).toBe(3);
    expect(acc.passed).toBe(2);
    expect(acc.failed).toBe(1);
    expect(acc.entitiesRun).toBe(2); // distinct entities that produced a verdict (e1, e2)
  });

  it('collects per-step fail rows with the entity name + checker reason (no silent fails)', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      failed: 1, results: [failResult('e2', 'Economy Gate', 'price/power 1.43x')],
    }));
    expect(acc.fails).toEqual([{ entityId: 'e2', entityName: 'Two', step: 'Economy Gate', reason: 'price/power 1.43x' }]);
  });

  it('a locked batch records EVERY requested entity as locked (all-or-nothing) with no flips', () => {
    const acc = summarizeBatchDrain(entities, { kind: 'locked' });
    expect(acc).toMatchObject({ entitiesLocked: 2, entitiesRun: 0, passed: 0, failed: 0 });
  });

  it('an errored batch records EVERY requested entity as errored', () => {
    const acc = summarizeBatchDrain(entities, { kind: 'error', reason: 'Network error' });
    expect(acc).toMatchObject({ entitiesErrored: 2, entitiesRun: 0 });
  });

  it('emptyBatchSummary is the zero value', () => {
    expect(emptyBatchSummary()).toMatchObject({ entitiesRun: 0, entitiesLocked: 0, entitiesErrored: 0, ran: 0, passed: 0, failed: 0, skipped: 0, fails: [] });
  });
});
