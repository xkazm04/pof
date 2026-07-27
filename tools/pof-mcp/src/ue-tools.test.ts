import test from 'node:test';
import assert from 'node:assert/strict';
import { UE_TOOLS } from './tools/ue.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';

/** A PofClient that records calls and can be told what a given path returns / throws. */
function recorder(responses: Record<string, unknown> = {}) {
  const calls: Array<{ method: 'get' | 'post'; path: string; body?: unknown }> = [];
  const reply = (path: string) => {
    const key = Object.keys(responses).find((k) => path.startsWith(k));
    const v = key ? responses[key] : { ok: true };
    if (v instanceof Error) throw v;
    return v;
  };
  const pof = {
    get: async (path: string) => { calls.push({ method: 'get', path }); return reply(path); },
    post: async (path: string, body: unknown) => { calls.push({ method: 'post', path, body }); return reply(path); },
  } as unknown as PofClient;
  return { pof, calls };
}

function tool(name: string): ToolDef {
  const t = UE_TOOLS.find((x) => x.name === name);
  assert.ok(t, `tool ${name} not registered`);
  return t!;
}

const SETTLE = '/api/pipeline-artifacts/drain/settle-test';

// ── pof_ue_run_tests — running a test now settles the gate waiting on it ──────

test('pof_ue_run_tests settles the deferred gates from the run payload', async () => {
  const { pof, calls } = recorder({
    '/api/pof-bridge/test': { status: 'passed', testId: 'VSSwordTest_1' },
    [SETTLE]: { matched: 1, settled: 1, passed: 1, note: 'Settled 1 gate(s)' },
  });
  const out = await tool('pof_ue_run_tests').handler({ filter: 'VSSwordTest', catalogId: 'items' }, pof) as Record<string, unknown>;

  assert.equal(calls.length, 2);
  assert.equal(calls[0].path.startsWith('/api/pof-bridge/test'), true);
  assert.equal(calls[1].path, SETTLE);
  // The RAW plugin payload is handed to the server, which owns all the verdict truth.
  assert.deepEqual(calls[1].body, {
    testName: 'VSSwordTest',
    result: { status: 'passed', testId: 'VSSwordTest_1' },
    catalogId: 'items',
  });
  assert.deepEqual(out.settle, { matched: 1, settled: 1, passed: 1, note: 'Settled 1 gate(s)' });
});

test('pof_ue_run_tests with settle:false runs the test and writes back nothing', async () => {
  const { pof, calls } = recorder();
  const out = await tool('pof_ue_run_tests').handler({ filter: 'VSSwordTest', settle: false }, pof) as Record<string, unknown>;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path.startsWith('/api/pof-bridge/test'), true);
  assert.deepEqual(out.settle, { skipped: 'settle:false — no gate was updated' });
});

test('pof_ue_run_tests REPORTS a refused settle (drain lease 409) instead of implying a flip', async () => {
  const { pof } = recorder({
    '/api/pof-bridge/test': { status: 'passed' },
    [SETTLE]: new Error('drain in flight for items/sword — refusing to settle over it'),
  });
  const out = await tool('pof_ue_run_tests').handler({ filter: 'VSSwordTest' }, pof) as { settle: { settled: number; error: string } };
  assert.equal(out.settle.settled, 0);
  assert.match(out.settle.error, /refusing to settle over it/);
});

// ── pof_ue_test_results — the poll-then-settle half ───────────────────────────

test('pof_ue_test_results settles only when a testName is given', async () => {
  const { pof, calls } = recorder({
    '/api/pof-bridge/test': { results: [{ testId: 'VSSwordTest_1', status: 'passed' }] },
    [SETTLE]: { matched: 1, settled: 1 },
  });

  // Plain read — no write-back, and the raw payload is returned unwrapped (unchanged shape).
  const raw = await tool('pof_ue_test_results').handler({}, pof) as Record<string, unknown>;
  assert.equal(calls.length, 1);
  assert.ok(Array.isArray(raw.results));

  const settled = await tool('pof_ue_test_results').handler({ testName: 'VSSwordTest' }, pof) as Record<string, unknown>;
  assert.equal(calls.length, 3);
  assert.equal(calls[2].path, SETTLE);
  assert.deepEqual(settled.settle, { matched: 1, settled: 1 });
});
