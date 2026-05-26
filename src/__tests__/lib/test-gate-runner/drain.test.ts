import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// In-memory store backing the mocked artifacts DB.
const store = new Map<string, PipelineArtifact>();
const key = (c: string, e: string, s: string) => `${c}|${e}|${s}`;

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  getArtifact: (c: string, e: string, s: string) => store.get(key(c, e, s)) ?? null,
  listDeferredArtifacts: (f?: { tier?: string; catalogId?: string; entityId?: string }) =>
    [...store.values()].filter((a) =>
      a.status === 'deferred' &&
      (!f?.tier || a.tier === f.tier) &&
      (!f?.catalogId || a.catalogId === f.catalogId) &&
      (!f?.entityId || a.entityId === f.entityId)),
  upsertArtifact: (a: PipelineArtifact) => { store.set(key(a.catalogId, a.entityId, a.step), a); return a; },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { collectDeferred, drainOne, drainAll } from '@/lib/test-gate-runner/drain';
import type { GateExecutor, GateJob, GateVerdict } from '@/lib/test-gate-runner/types';

function seed(a: Partial<PipelineArtifact> & { catalogId: string; entityId: string; step: string }) {
  const full = { data: {}, ueAssets: [], status: 'deferred', ...a } as PipelineArtifact;
  store.set(key(full.catalogId, full.entityId, full.step), full);
}

function fakeExec(opts: {
  tier: 'L3' | 'L4';
  available?: boolean;
  runFn?: (job: GateJob) => Promise<GateVerdict>;
}): GateExecutor {
  return {
    id: `fake-${opts.tier}`,
    tier: opts.tier,
    available: async () => opts.available ?? true,
    run: opts.runFn ?? (async () => ({ status: 'pass', detail: 'ok' })),
  };
}

beforeEach(() => store.clear());

describe('collectDeferred', () => {
  it('maps deferred rows to jobs + recovers the L3 test name from the reason', () => {
    seed({ catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3', reason: 'live-UE runner not yet run: VSItemsTest' });
    seed({ catalogId: 'materials', entityId: 'mat-1', step: 'Visual', tier: 'L4', reason: 'RHI+Gemini visual check not yet run' });
    seed({ catalogId: 'items', entityId: 'item-1', step: 'Attributes', tier: 'L0', status: 'pass' }); // not deferred

    const jobs = collectDeferred();
    expect(jobs).toHaveLength(2);
    const l3 = jobs.find((j) => j.tier === 'L3')!;
    expect(l3.testName).toBe('VSItemsTest');
    const l4 = jobs.find((j) => j.tier === 'L4')!;
    expect(l4.testName).toBeUndefined();
  });

  it('honours the tier/catalog filter', () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: T' });
    seed({ catalogId: 'materials', entityId: 'b', step: 'v', tier: 'L4' });
    expect(collectDeferred({ tier: 'L4' })).toHaveLength(1);
    expect(collectDeferred({ catalogId: 'items' })).toHaveLength(1);
  });
});

describe('drainOne', () => {
  it('writes the verdict back, flipping deferred→pass and preserving data/assets/tier', async () => {
    seed({ catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3', data: { foo: 1 }, ueAssets: ['/Game/X'], reason: 'live-UE runner not yet run: VSItemsTest' });
    const job: GateJob = { catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3', testName: 'VSItemsTest' };
    await drainOne(job, fakeExec({ tier: 'L3', runFn: async () => ({ status: 'pass', detail: 'VSItemsTest: 19 passed' }) }));

    const row = store.get(key('items', 'item-1', 'Test Gate'))!;
    expect(row.status).toBe('pass');
    expect(row.tier).toBe('L3');
    expect(row.reason).toBe('VSItemsTest: 19 passed');
    expect(row.data).toEqual({ foo: 1 }); // preserved
    expect(row.ueAssets).toEqual(['/Game/X']);
  });
});

describe('drainAll', () => {
  it('runs matched jobs and tallies pass/fail', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TPass' });
    seed({ catalogId: 'items', entityId: 'b', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TFail' });
    const exec = fakeExec({ tier: 'L3', runFn: async (j) => ({ status: j.testName === 'TFail' ? 'fail' : 'pass', detail: j.testName! }) });

    const sum = await drainAll([exec]);
    expect(sum).toMatchObject({ ran: 2, passed: 1, failed: 1, skipped: 0 });
    expect(store.get(key('items', 'a', 'g'))!.status).toBe('pass');
    expect(store.get(key('items', 'b', 'g'))!.status).toBe('fail');
  });

  it('skips (stays deferred) when there is no executor for the tier', async () => {
    seed({ catalogId: 'materials', entityId: 'm', step: 'v', tier: 'L4' });
    const sum = await drainAll([fakeExec({ tier: 'L3' })]);
    expect(sum).toMatchObject({ ran: 0, skipped: 1 });
    expect(sum.results[0].skipped).toMatch(/no L4 executor/);
    expect(store.get(key('materials', 'm', 'v'))!.status).toBe('deferred');
  });

  it('skips an L3 job with no recoverable test name', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'malformed reason' });
    const sum = await drainAll([fakeExec({ tier: 'L3' })]);
    expect(sum).toMatchObject({ ran: 0, skipped: 1 });
    expect(sum.results[0].skipped).toMatch(/no test name/);
  });

  it('skips when the executor is unavailable', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: T' });
    const sum = await drainAll([fakeExec({ tier: 'L3', available: false })]);
    expect(sum).toMatchObject({ ran: 0, skipped: 1 });
    expect(sum.results[0].skipped).toMatch(/unavailable/);
  });

  it('marks a thrown executor as skipped, leaving the row deferred', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: T' });
    const exec = fakeExec({ tier: 'L3', runFn: async () => { throw new Error('boom'); } });
    const sum = await drainAll([exec]);
    expect(sum).toMatchObject({ ran: 0, skipped: 1 });
    expect(sum.results[0].skipped).toBe('boom');
    expect(store.get(key('items', 'a', 'g'))!.status).toBe('deferred');
  });

  it('respects the run limit', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: T1' });
    seed({ catalogId: 'items', entityId: 'b', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: T2' });
    const sum = await drainAll([fakeExec({ tier: 'L3' })], undefined, { limit: 1 });
    expect(sum.ran).toBe(1);
    expect(sum.results.some((r) => r.skipped === 'limit reached')).toBe(true);
  });
});
