import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const settleMock = vi.fn();
vi.mock('@/lib/test-gate-runner/settleFromTest', () => ({
  settleGatesFromTestRun: (...a: unknown[]) => settleMock(...a),
}));

import { POST } from '@/app/api/pipeline-artifacts/drain/settle-test/route';
import { acquireLeases, releaseLeases, __resetLeases } from '@/lib/test-gate-runner/drain-lease';

const post = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/pipeline-artifacts/drain/settle-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  __resetLeases();
  settleMock.mockReset();
  settleMock.mockReturnValue({ matched: 1, settled: 1, passed: 1, failed: 0, deferred: 0, gates: [], note: 'ok' });
});

describe('POST /api/pipeline-artifacts/drain/settle-test', () => {
  it('settles the matching gates and returns the outcome in the standard envelope', async () => {
    const res = await POST(post({ testName: 'VSSwordTest', result: { status: 'passed' }, catalogId: 'items' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: { settled: 1, passed: 1 } });
    // Scope is parsed with the SAME drain filter surface.
    expect(settleMock).toHaveBeenCalledWith('VSSwordTest', { status: 'passed' }, { catalogId: 'items' });
  });

  it('reports a no-match settle as success that changed nothing', async () => {
    settleMock.mockReturnValue({ matched: 0, settled: 0, passed: 0, failed: 0, deferred: 0, gates: [], note: 'No deferred L3 gate is waiting on "X" in this scope — nothing was changed.' });
    const res = await POST(post({ testName: 'X', result: { status: 'passed' } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ matched: 0, settled: 0 });
    expect(json.data.note).toContain('nothing was changed');
  });

  it('409s rather than clobbering a drain that holds the scope', async () => {
    expect(acquireLeases(['items|sword']).ok).toBe(true); // a drain is in flight for this entity
    const res = await POST(post({ testName: 'VSSwordTest', result: { status: 'passed' }, catalogId: 'items', entityId: 'sword' }));
    expect(res.status).toBe(409);
    expect(settleMock).not.toHaveBeenCalled();
    releaseLeases(['items|sword']);
  });

  it('releases its lease so a later drain can run', async () => {
    await POST(post({ testName: 'VSSwordTest', result: { status: 'passed' }, catalogId: 'items', entityId: 'sword' }));
    expect(acquireLeases(['items|sword']).ok).toBe(true);
  });

  it('rejects a missing testName or a missing result payload', async () => {
    expect((await POST(post({ result: { status: 'passed' } }))).status).toBe(400);
    expect((await POST(post({ testName: 'VSSwordTest' }))).status).toBe(400);
    expect(settleMock).not.toHaveBeenCalled();
  });
});
