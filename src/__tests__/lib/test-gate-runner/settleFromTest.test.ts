import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// In-memory store backing the mocked artifacts DB (same shape drain.test.ts uses).
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

import { settleGatesFromTestRun, gatesWaitingOnTest } from '@/lib/test-gate-runner/settleFromTest';

function seed(a: Partial<PipelineArtifact> & { catalogId: string; entityId: string; step: string }) {
  const full = { data: {}, ueAssets: [], status: 'deferred', tier: 'L3', ...a } as PipelineArtifact;
  store.set(key(full.catalogId, full.entityId, full.step), full);
}
const read = (c: string, e: string, s: string) => store.get(key(c, e, s))!;

// The reason contract the L3 acceptance writer emits and `parseTestName` recovers.
const deferredFor = (test: string) => `live-UE runner not yet run: ${test}`;

beforeEach(() => store.clear());

describe('settleGatesFromTestRun — an agent-run test settles its gate', () => {
  it('flips every deferred gate waiting on the test to pass', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });
    seed({ catalogId: 'items', entityId: 'shield', step: 'Test Gate', reason: deferredFor('VSSwordTest') });
    seed({ catalogId: 'items', entityId: 'bow', step: 'Test Gate', reason: deferredFor('VSBowTest') }); // different test

    const out = settleGatesFromTestRun('VSSwordTest', { status: 'passed', testId: 'VSSwordTest_1' });

    expect(out).toMatchObject({ matched: 2, settled: 2, passed: 2, failed: 0, deferred: 0 });
    expect(read('items', 'sword', 'Test Gate').status).toBe('pass');
    expect(read('items', 'shield', 'Test Gate').status).toBe('pass');
    // The unrelated gate is untouched.
    expect(read('items', 'bow', 'Test Gate').status).toBe('deferred');
  });

  it('writes a fail with the plugin reason (never a silent flip)', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });

    const out = settleGatesFromTestRun('VSSwordTest', { status: 'failed', errors: ['damage was 0, expected 12'] });

    expect(out).toMatchObject({ matched: 1, settled: 1, failed: 1 });
    const row = read('items', 'sword', 'Test Gate');
    expect(row.status).toBe('fail');
    expect(row.reason).toContain('damage was 0');
  });

  it('preserves the artifact data and merges evidence, exactly like a drain write-back', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest'), data: { genHistory: { batches: [] }, price: 12 } });

    settleGatesFromTestRun('VSSwordTest', { status: 'passed' });

    const row = read('items', 'sword', 'Test Gate');
    expect(row.data).toMatchObject({ price: 12 });
    expect((row.data as { evidence?: { kind?: string } }).evidence?.kind).toBe('bridge');
    expect(row.tier).toBe('L3');
  });

  it('a result matching NO gate changes nothing and says so', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });

    const out = settleGatesFromTestRun('VSSomethingElseTest', { status: 'passed' });

    expect(out).toMatchObject({ matched: 0, settled: 0 });
    expect(out.note).toContain('No deferred L3 gate is waiting');
    expect(out.note).toContain('nothing was changed');
    expect(read('items', 'sword', 'Test Gate').status).toBe('deferred');
  });

  it('a non-terminal run settles nothing and names the pending state (no fabricated verdict)', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });

    const out = settleGatesFromTestRun('VSSwordTest', { status: 'accepted', testId: 'x1' });

    expect(out).toMatchObject({ matched: 1, settled: 0, passed: 0, failed: 0 });
    expect(out.note).toContain('not produced a terminal result');
    expect(read('items', 'sword', 'Test Gate').status).toBe('deferred');
  });

  it("the plugin's not_found stays DEFERRED (planned, not registered) — never a red fail", () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });

    const out = settleGatesFromTestRun('VSSwordTest', { status: 'not_found' });

    expect(out).toMatchObject({ matched: 1, settled: 1, deferred: 1, failed: 0, passed: 0 });
    const row = read('items', 'sword', 'Test Gate');
    expect(row.status).toBe('deferred');
    expect(row.reason).toContain('no automation test registered');
  });

  it('reads the results-array payload shape too (a poll, not just the run POST)', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });

    const out = settleGatesFromTestRun('VSSwordTest', { results: [{ testId: 'VSSwordTest_1', status: 'passed' }] });

    expect(out.passed).toBe(1);
    expect(read('items', 'sword', 'Test Gate').status).toBe('pass');
  });

  it('honours the scope filter and never touches an L4 gate', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'Test Gate', reason: deferredFor('VSSwordTest') });
    seed({ catalogId: 'weapons', entityId: 'axe', step: 'Test Gate', reason: deferredFor('VSSwordTest') });
    seed({ catalogId: 'items', entityId: 'sword', step: 'Visual', tier: 'L4', reason: deferredFor('VSSwordTest') });

    expect(gatesWaitingOnTest('VSSwordTest')).toHaveLength(2); // L3 only — the L4 row is excluded
    const out = settleGatesFromTestRun('VSSwordTest', { status: 'passed' }, { catalogId: 'items' });

    expect(out.settled).toBe(1);
    expect(read('weapons', 'axe', 'Test Gate').status).toBe('deferred');
    expect(read('items', 'sword', 'Visual').status).toBe('deferred');
  });
});
