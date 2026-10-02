/**
 * Waiting tests: the UE automation tests deferred L3 gates are waiting on, and the
 * lease-checked run + settle a human can trigger from the Test Harness.
 *
 * Pinned here (acceptance cases 1-5 of ue5-bridge-monitoring/B):
 *   1. groupWaitingTests ranks named L3 tests by gates, counts unnamed, drops L4;
 *   2. a held drain lease is never raced: busy, and nothing is posted;
 *   3. lease free -> run-automation, then settle-test with the raw payload;
 *   4. a bridge error settles nothing;
 *   5. a refused settle (drain started after the check) says the test RAN and no gate
 *      was written — it is never reported as settled.
 */

import { describe, it, expect, vi } from 'vitest';
import { ok, err, type Result } from '@/types/result';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { SettleOutcome } from '@/lib/test-gate-runner/settleFromTest';
import {
  groupWaitingTests, runWaitingTest, type WaitingTestsApi,
} from '@/components/modules/project-setup/TestHarnessPanel/waitingTests';

function job(p: Partial<GateJob>): GateJob {
  return { catalogId: 'items', entityId: 'e', step: 's', tier: 'L3', ...p };
}

const FREE = { held: false, scope: null, since: null, scopes: [] };
const PASSED = { status: 'passed', testId: 'FVSCodexUnlockTest' };
const OUTCOME: SettleOutcome = {
  matched: 2, settled: 2, passed: 2, failed: 0, deferred: 0, gates: [],
  note: '2 gate(s) settled from VSCodexUnlockTest.',
};

function fakeApi(opts: {
  lease?: Result<unknown, string>;
  run?: Result<unknown, string>;
  settle?: Result<unknown, string>;
}): WaitingTestsApi & { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async () => opts.lease ?? ok(FREE));
  const post = vi.fn(async (url: string) =>
    url === '/api/pof-bridge/test' ? (opts.run ?? ok(PASSED)) : (opts.settle ?? ok(OUTCOME)),
  );
  return { get, post } as never;
}

describe('groupWaitingTests (case 1)', () => {
  it('ranks named L3 tests by gates desc, sorts catalogs, counts unnamed, excludes L4', () => {
    const jobs: GateJob[] = [
      job({ testName: 'PoF.GenFireball.EffectConfig', catalogId: 'spellbook', entityId: 'a' }),
      job({ testName: 'PoF.GenFireball.EffectConfig', catalogId: 'items', entityId: 'b' }),
      job({ testName: 'PoF.GenFireball.EffectConfig', catalogId: 'spellbook', entityId: 'c' }),
      job({ testName: 'VSCodexUnlockTest', catalogId: 'codex', entityId: 'd' }),
      job({ entityId: 'no-name' }),
      job({ tier: 'L4', testName: 'X', entityId: 'visual' }),
    ];
    expect(groupWaitingTests(jobs)).toEqual({
      tests: [
        { testName: 'PoF.GenFireball.EffectConfig', gates: 3, catalogs: ['items', 'spellbook'] },
        { testName: 'VSCodexUnlockTest', gates: 1, catalogs: ['codex'] },
      ],
      unnamed: 1,
    });
  });
});

describe('runWaitingTest', () => {
  it('case 2: a held drain lease is never raced — busy, and nothing is posted', async () => {
    const api = fakeApi({ lease: ok({ held: true, scope: '*|*', since: '2026-09-29T10:00:00Z', scopes: ['*|*'] }) });
    const r = await runWaitingTest('VSCodexUnlockTest', api);
    expect(r).toMatchObject({ kind: 'busy', scope: '*|*' });
    expect(api.get).toHaveBeenCalledWith('/api/pipeline-artifacts/drain/status');
    expect(api.post).toHaveBeenCalledTimes(0);
  });

  it('case 3: lease free -> run-automation, then settle-test with the raw payload', async () => {
    const api = fakeApi({});
    const r = await runWaitingTest('VSCodexUnlockTest', api);
    expect(api.post.mock.calls).toEqual([
      ['/api/pof-bridge/test', { action: 'run-automation', filter: 'VSCodexUnlockTest' }],
      ['/api/pipeline-artifacts/drain/settle-test', { testName: 'VSCodexUnlockTest', result: PASSED }],
    ]);
    expect(r).toMatchObject({ kind: 'settled', outcome: OUTCOME });
  });

  it('case 4: a bridge error settles nothing', async () => {
    const api = fakeApi({ run: err('connect ECONNREFUSED 127.0.0.1:30040') });
    const r = await runWaitingTest('VSCodexUnlockTest', api);
    expect(r.kind).toBe('bridge-error');
    expect(r.kind === 'bridge-error' && r.error).toContain('ECONNREFUSED');
    expect(api.post.mock.calls.map((c) => c[0])).not.toContain('/api/pipeline-artifacts/drain/settle-test');
  });

  it('case 5: a refused settle says the test ran and no gate was written', async () => {
    const api = fakeApi({ settle: err('drain in flight for *|* — refusing to settle over it') });
    const r = await runWaitingTest('VSCodexUnlockTest', api);
    expect(r).toMatchObject({ kind: 'settle-error', ran: true, bridgeResult: { status: 'passed' } });
    expect(r.kind === 'settle-error' && r.error).toContain('refusing to settle');
    expect(r.kind).not.toBe('settled');
  });

  it('an unreadable lease state runs nothing (the lease is unknown, not free)', async () => {
    const api = fakeApi({ lease: err('lease status failed') });
    const r = await runWaitingTest('VSCodexUnlockTest', api);
    expect(r.kind).toBe('lease-error');
    expect(api.post).toHaveBeenCalledTimes(0);
  });
});
