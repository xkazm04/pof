import test from 'node:test';
import assert from 'node:assert/strict';
import { UE_TOOLS } from './tools/ue.js';
import { waitForBuild, BUILD_WAIT_MAX_S } from './tools/ue.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';

const buildStatus = (): ToolDef => {
  const t = UE_TOOLS.find((x) => x.name === 'pof_ue_build_status');
  assert.ok(t, 'pof_ue_build_status not registered');
  return t!;
};

/** A client that walks a scripted sequence of build payloads, one per GET. */
function scripted(seq: unknown[]) {
  const calls: string[] = [];
  let i = 0;
  const pof = {
    get: async (path: string) => {
      calls.push(path);
      const v = seq[Math.min(i, seq.length - 1)];
      i += 1;
      if (v instanceof Error) throw v;
      return v;
    },
    post: async () => ({}),
  } as unknown as PofClient;
  return { pof, calls };
}

type WaitEnvelope = { result: unknown; wait: Record<string, unknown> };

test('no waitSeconds → one immediate read, unchanged shape', async () => {
  const { pof, calls } = scripted([{ buildId: 'b1', status: 'running' }]);
  const out = await buildStatus().handler({ buildId: 'b1' }, pof);
  assert.deepEqual(out, { buildId: 'b1', status: 'running' }, 'the plain read must not be wrapped');
  assert.equal(calls.length, 1);
});

test('waitSeconds without a buildId is refused, not slept on', async () => {
  const { pof, calls } = scripted([{ queue: [] }]);
  const out = (await buildStatus().handler({ waitSeconds: 30 }, pof)) as WaitEnvelope;
  assert.match(String(out.wait.skipped), /needs a buildId/);
  assert.equal(calls.length, 1, 'it should still return the read it was asked for');
});

test('a wait returns as soon as the build settles', async () => {
  const { pof, calls } = scripted([
    { buildId: 'b1', status: 'queued' },
    { buildId: 'b1', status: 'running' },
    { buildId: 'b1', status: 'success' },
    { buildId: 'b1', status: 'success' },
  ]);
  const out = (await buildStatus().handler({ buildId: 'b1', waitSeconds: 30 }, pof)) as WaitEnvelope;
  assert.equal(out.wait.settled, true);
  assert.equal(out.wait.status, 'success');
  assert.equal(out.wait.polls, 3, 'it must stop at the first terminal read, not keep polling');
  assert.equal(calls.length, 3);
});

test('every terminal state ends the wait — failed and aborted are settlements too', async () => {
  for (const status of ['success', 'failed', 'aborted']) {
    const { pof } = scripted([{ status }]);
    const out = (await waitForBuild(() => pof.get(''), 5, { pollMs: 1 })) as WaitEnvelope;
    assert.equal(out.wait.settled, true, `${status} should settle the wait`);
    assert.equal(out.wait.status, status);
  }
});

test('a wait that runs out reports the real status and NOT a verdict', async () => {
  // A frozen clock that jumps past the deadline after the first poll.
  let t = 0;
  const { pof } = scripted([{ buildId: 'b1', status: 'running' }]);
  const out = (await waitForBuild(() => pof.get(''), 10, {
    pollMs: 1,
    now: () => { const v = t; t += 20_000; return v; },
  })) as WaitEnvelope;
  assert.equal(out.wait.settled, false);
  assert.equal(out.wait.status, 'running');
  assert.match(String(out.wait.note), /NOT a verdict/);
  assert.deepEqual(out.result, { buildId: 'b1', status: 'running' }, 'the last real payload comes back');
});

test('a failing read returns at once instead of waiting out the budget', async () => {
  const { pof, calls } = scripted([new Error('Build b-missing not found')]);
  const out = (await waitForBuild(() => pof.get(''), 120, { pollMs: 1 })) as WaitEnvelope;
  assert.equal(out.wait.settled, false);
  assert.match(String(out.wait.error), /not found/);
  assert.equal(calls.length, 1, 'a 404 must not be retried — it will never become terminal');
});

test('waitSeconds is clamped, and the clamp is reported', async () => {
  let t = 0;
  const { pof } = scripted([{ status: 'running' }]);
  const out = (await waitForBuild(() => pof.get(''), 99_999, {
    pollMs: 1,
    now: () => { const v = t; t += 10_000_000; return v; },
  })) as WaitEnvelope;
  assert.equal(out.wait.budgetSeconds, BUILD_WAIT_MAX_S);
  assert.match(String(out.wait.clamped), new RegExp(String(BUILD_WAIT_MAX_S)));
});

test('the schema advertises waitSeconds and the description says it needs a buildId', () => {
  const s = buildStatus().inputSchema as { properties: Record<string, { description?: string }> };
  assert.ok(s.properties.waitSeconds, 'waitSeconds is not advertised');
  assert.match(String(s.properties.waitSeconds.description), /buildId/);
  assert.match(buildStatus().description, /terminal/);
});
