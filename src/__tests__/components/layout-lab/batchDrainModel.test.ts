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
const deferredResult = (entityId: string, step: string, reason: string) => ({
  job: { catalogId: 'c', entityId, step, tier: 'L3' as const },
  verdict: { status: 'deferred' as const, detail: reason },
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
    expect(emptyBatchSummary()).toMatchObject({
      entitiesRun: 0, entitiesLocked: 0, entitiesErrored: 0,
      ran: 0, passed: 0, failed: 0, deferred: 0, skipped: 0,
      fails: [], deferrals: [], screenshots: [],
    });
  });

  it('carries DEFERRED gates through with their reasons — deferred is not zero, and is not skipped', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      ran: 2, deferred: 2, skipped: 1,
      results: [
        deferredResult('e1', 'Combat Gate', 'planned, not registered in UE'),
        deferredResult('e2', 'Render Gate', 'judge unavailable'),
        { job: { catalogId: 'c', entityId: 'e2', step: 'Late Gate', tier: 'L3' as const }, skipped: 'limit reached' },
      ],
    }));
    // The count the UI used to drop entirely.
    expect(acc.deferred).toBe(2);
    // …and it is NOT conflated with the never-ran bucket.
    expect(acc.skipped).toBe(1);
    expect(acc.deferrals).toEqual([
      { entityId: 'e1', entityName: 'One', step: 'Combat Gate', reason: 'planned, not registered in UE' },
      { entityId: 'e2', entityName: 'Two', step: 'Render Gate', reason: 'judge unavailable' },
    ]);
    // A deferral is never mistaken for a fail.
    expect(acc.fails).toEqual([]);
  });

  it('carries the captured L4 frames through so a caller can actually look at them', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      ran: 1, passed: 1, screenshots: ['/tmp/pof_l4_1/shot_02.png', '/tmp/pof_l4_2/shot_00.png'],
      results: [passResult('e1', 'Render Gate')],
    }));
    expect(acc.screenshots).toEqual(['/tmp/pof_l4_1/shot_02.png', '/tmp/pof_l4_2/shot_00.png']);
  });

  it('a mixed drain (pass + fail + deferred + skipped + frames) survives intact', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      ran: 3, passed: 1, failed: 1, deferred: 1, skipped: 1,
      screenshots: ['/tmp/pof_l4_scn_9/shot_01.png'],
      results: [
        passResult('e1', 'A'),
        failResult('e1', 'B', 'price/power 1.43x'),
        deferredResult('e2', 'C', 'judge unavailable'),
        { job: { catalogId: 'c', entityId: 'e2', step: 'D', tier: 'L4' as const }, skipped: 'visual unavailable' },
      ],
    }));
    expect(acc).toMatchObject({ ran: 3, passed: 1, failed: 1, deferred: 1, skipped: 1, entitiesRun: 2 });
    expect(acc.fails).toHaveLength(1);
    expect(acc.deferrals).toHaveLength(1);
    expect(acc.screenshots).toHaveLength(1);
  });

  it('a verdict with no detail still gets an honest reason (never an empty row)', () => {
    const acc = summarizeBatchDrain(entities, okOutcome({
      ran: 2, failed: 1, deferred: 1,
      results: [
        { job: { catalogId: 'c', entityId: 'e1', step: 'A', tier: 'L3' as const }, verdict: { status: 'fail' as const, detail: '' } },
        { job: { catalogId: 'c', entityId: 'e2', step: 'B', tier: 'L3' as const }, verdict: { status: 'deferred' as const, detail: '' } },
      ],
    }));
    expect(acc.fails[0].reason).toBe('failed acceptance');
    expect(acc.deferrals[0].reason).toBe('no reason given');
  });
});
