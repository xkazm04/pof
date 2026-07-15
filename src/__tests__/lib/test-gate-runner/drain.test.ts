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

describe('drainOne — evidence', () => {
  it('persists structured evidence into data.evidence while PRESERVING prior data + genHistory', async () => {
    seed({ catalogId: 'items', entityId: 'i1', step: 'Test Gate', tier: 'L3', data: { foo: 1, genHistory: { batches: [{ id: 0 }] } }, ueAssets: ['/Game/X'], reason: 'live-UE runner not yet run: T' });
    const evidence = { kind: 'scenario' as const, at: '2026-07-13T00:00:00Z', stats: { swingDeg: 12.3, distance: 970, sampleCount: 4, montagePlaying: 0 }, samples: [] };
    const job: GateJob = { catalogId: 'items', entityId: 'i1', step: 'Test Gate', tier: 'L3', testName: 'T' };
    await drainOne(job, fakeExec({ tier: 'L3', runFn: async () => ({ status: 'pass', detail: 'ok', evidence }) }));

    const row = store.get(key('items', 'i1', 'Test Gate'))!;
    expect(row.status).toBe('pass');
    // Evidence merged in…
    expect(row.data.evidence).toEqual(evidence);
    // …without clobbering anything already in data.
    expect(row.data.foo).toBe(1);
    expect(row.data.genHistory).toEqual({ batches: [{ id: 0 }] });
    expect(row.ueAssets).toEqual(['/Game/X']);
  });

  it('leaves prior data untouched when the verdict carries no evidence', async () => {
    seed({ catalogId: 'items', entityId: 'i2', step: 'g', tier: 'L3', data: { genHistory: { batches: [] } }, reason: 'live-UE runner not yet run: T' });
    await drainOne({ catalogId: 'items', entityId: 'i2', step: 'g', tier: 'L3', testName: 'T' }, fakeExec({ tier: 'L3', runFn: async () => ({ status: 'pass', detail: 'ok' }) }));
    const row = store.get(key('items', 'i2', 'g'))!;
    expect(row.data).toEqual({ genHistory: { batches: [] } }); // no `evidence` key added
  });

  it('overlapping drainOne calls on the same row lose no evidence and preserve prior data', async () => {
    // Two drains resolve their executor.run on the microtask queue, then race to write. Because
    // drainOne's read→merge→write has NO await between getArtifact and upsertArtifact, each write
    // is atomic on the event loop: prior data (foo) survives and the row ends with a well-formed
    // evidence object (no torn/undefined write). The lease additionally serializes real passes.
    seed({ catalogId: 'items', entityId: 'race', step: 'g', tier: 'L3', data: { foo: 1 }, reason: 'live-UE runner not yet run: T' });
    const job: GateJob = { catalogId: 'items', entityId: 'race', step: 'g', tier: 'L3', testName: 'T' };
    const ev = (n: number) => ({ kind: 'automation' as const, at: `2026-07-15T00:00:0${n}Z`, markers: [`run-${n}`] });
    const mkExec = (n: number) => fakeExec({ tier: 'L3', runFn: async () => { await Promise.resolve(); return { status: 'pass' as const, detail: `ok-${n}`, evidence: ev(n) }; } });

    await Promise.all([drainOne(job, mkExec(1)), drainOne(job, mkExec(2))]);

    const row = store.get(key('items', 'race', 'g'))!;
    expect(row.status).toBe('pass');
    expect(row.data.foo).toBe(1); // prior data never lost
    expect(row.data.evidence).toBeDefined();
    expect((row.data.evidence as { markers: string[] }).markers[0]).toMatch(/^run-[12]$/); // a real evidence, not torn
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

  it('buckets a deferred verdict as ran+deferred (NOT passed/failed/skipped)', async () => {
    // A "test not registered" (or judge outage) resolves to a deferred VERDICT: the gate ran,
    // produced no pass/fail, and stays deferred — distinct from `skipped` (never ran).
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TUnreg' });
    const exec = fakeExec({ tier: 'L3', runFn: async () => ({ status: 'deferred', detail: 'TUnreg: no automation test registered' }) });
    const sum = await drainAll([exec]);
    expect(sum).toMatchObject({ ran: 1, passed: 0, failed: 0, deferred: 1, skipped: 0 });
    expect(store.get(key('items', 'a', 'g'))!.status).toBe('deferred');
    expect(store.get(key('items', 'a', 'g'))!.reason).toMatch(/no automation test registered/);
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

describe('drainJobs — grouped boot (prepareBatch) integration', () => {
  it('N automation gates in one drain → prepareBatch runs ONCE with all tier-matched jobs; run() serves the cache', async () => {
    // Three deferred automation gates. A batch-capable executor pre-runs them in ONE shot
    // (the real spawn executor boots ONE editor); `boots` proves it happens once, not per job.
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TA' });
    seed({ catalogId: 'loot', entityId: 'b', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TB' });
    seed({ catalogId: 'hud', entityId: 'c', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TC' });

    let boots = 0;
    const cache = new Map<string, GateVerdict>();
    let prepareCalls = 0;
    const batchExec: GateExecutor = {
      id: 'fake-batch',
      tier: 'L3',
      available: async () => true,
      async prepareBatch(jobs) {
        prepareCalls++;
        boots++; // ONE boot for the whole batch
        for (const j of jobs) cache.set(j.testName!, { status: 'pass', detail: `${j.testName}: report: 1 passed` });
      },
      async run(job) {
        const cached = cache.get(job.testName!);
        if (cached) return cached;
        boots++; // any per-job boot would bump this — must stay 1
        return { status: 'fail', detail: 'unexpected per-job boot' };
      },
    };

    const sum = await drainAll([batchExec]);
    expect(prepareCalls).toBe(1);
    expect(boots).toBe(1); // ONE boot for three automation gates
    expect(sum).toMatchObject({ ran: 3, passed: 3, failed: 0 });
  });

  it('retries a failed grouped boot ONCE, then degrades to per-job boots WITHOUT parking the jobs', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TA' });
    seed({ catalogId: 'loot', entityId: 'b', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TB' });
    let prepareCalls = 0;
    const perJobRuns: string[] = [];
    const ex: GateExecutor = {
      id: 'flaky-batch',
      tier: 'L3',
      available: async () => true,
      async prepareBatch() { prepareCalls++; throw new Error('grouped boot exploded'); },
      async run(job) { perJobRuns.push(job.entityId); return { status: 'pass', detail: job.testName! }; },
    };
    const sum = await drainAll([ex]);
    expect(prepareCalls).toBe(2); // one attempt + one retry (both threw), then degraded
    expect(sum).toMatchObject({ ran: 2, passed: 2, skipped: 0 }); // both jobs still ran per-job
    expect(perJobRuns.sort()).toEqual(['a', 'b']);
    expect(store.get(key('items', 'a', 'g'))!.status).toBe('pass');
  });

  it('a grouped boot that succeeds on RETRY still serves the cache (no per-job boots)', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TA' });
    let prepareCalls = 0;
    const cache = new Map<string, GateVerdict>();
    const ex: GateExecutor = {
      id: 'retry-batch',
      tier: 'L3',
      available: async () => true,
      async prepareBatch(jobs) {
        prepareCalls++;
        if (prepareCalls === 1) throw new Error('transient boot failure');
        for (const j of jobs) cache.set(j.testName!, { status: 'pass', detail: `${j.testName}: cached` });
      },
      async run(job) {
        const cached = cache.get(job.testName!);
        if (cached) return cached;
        return { status: 'fail', detail: 'unexpected per-job boot' };
      },
    };
    const sum = await drainAll([ex]);
    expect(prepareCalls).toBe(2);
    expect(sum).toMatchObject({ ran: 1, passed: 1 });
    expect(store.get(key('items', 'a', 'g'))!.reason).toMatch(/cached/);
  });

  it('does not prepare/boot an UNAVAILABLE executor', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TA' });
    let prepareCalls = 0;
    const ex: GateExecutor = {
      id: 'fake', tier: 'L3',
      available: async () => false,
      async prepareBatch() { prepareCalls++; },
      run: async () => ({ status: 'pass', detail: 'ok' }),
    };
    const sum = await drainAll([ex]);
    expect(prepareCalls).toBe(0);
    expect(sum).toMatchObject({ ran: 0, skipped: 1 });
  });
});

describe('collectDeferred — multi-entity batch (entityIds)', () => {
  it('restricts a catalog collection to the requested entity set in ONE pass', () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TA' });
    seed({ catalogId: 'items', entityId: 'b', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TB' });
    seed({ catalogId: 'items', entityId: 'c', step: 'g', tier: 'L3', reason: 'live-UE runner not yet run: TC' });
    const jobs = collectDeferred({ catalogId: 'items', entityIds: ['a', 'c'] });
    expect(jobs.map((j) => j.entityId).sort()).toEqual(['a', 'c']);
  });
});
