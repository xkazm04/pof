import test from 'node:test';
import assert from 'node:assert/strict';
import { HARNESS_TOOLS } from './tools/harness.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';

/** A PofClient that records the last get/post it was handed. */
function recorder() {
  const calls: Array<{ method: 'get' | 'post'; path: string; body?: unknown }> = [];
  const pof = {
    get: async (path: string) => { calls.push({ method: 'get', path }); return { ok: true }; },
    post: async (path: string, body: unknown) => { calls.push({ method: 'post', path, body }); return { ok: true }; },
  } as unknown as PofClient;
  return { pof, calls };
}

function tool(name: string): ToolDef {
  const t = HARNESS_TOOLS.find((x) => x.name === name);
  assert.ok(t, `tool ${name} not registered`);
  return t!;
}

// ── pof_harness_start — new steering levers pass through to the POST body ─────

test('pof_harness_start threads themeDirective, sessionTimeoutMs, areaPassThreshold, passRateBasis', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_start').handler(
    {
      projectPath: 'C:/proj', projectName: 'Proj', ueVersion: '5.8',
      themeDirective: 'Star Wars ARPG', sessionTimeoutMs: 12345,
      areaPassThreshold: 80, passRateBasis: 'self-reported',
    },
    pof,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'post');
  assert.equal(calls[0].path, '/api/harness');
  const body = calls[0].body as Record<string, unknown>;
  assert.equal(body.action, 'start');
  assert.equal(body.themeDirective, 'Star Wars ARPG');
  assert.equal(body.sessionTimeoutMs, 12345);
  assert.equal(body.areaPassThreshold, 80);
  assert.equal(body.passRateBasis, 'self-reported');
});

test('pof_harness_start omits optional levers when not supplied', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_start').handler(
    { projectPath: 'C:/proj', projectName: 'Proj', ueVersion: '5.8' },
    pof,
  );
  const body = calls[0].body as Record<string, unknown>;
  assert.ok(!('themeDirective' in body));
  assert.ok(!('areaPassThreshold' in body));
  assert.ok(!('passRateBasis' in body));
  assert.ok(!('sessionTimeoutMs' in body));
});

// ── run-history proxy tools ──────────────────────────────────────────────────

test('pof_harness_runs proxies GET /api/harness/runs with optional filters', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_runs').handler({}, pof);
  assert.equal(calls[0].path, '/api/harness/runs');

  calls.length = 0;
  await tool('pof_harness_runs').handler({ limit: 5, project: 'C:/proj' }, pof);
  assert.match(calls[0].path, /^\/api\/harness\/runs\?/);
  assert.match(calls[0].path, /limit=5/);
  assert.match(calls[0].path, /project=C%3A%2Fproj/);
});

test('pof_harness_run proxies GET /api/harness/runs/:id (encoded) and requires runId', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_run').handler({ runId: 'run_ab/cd' }, pof);
  assert.equal(calls[0].path, '/api/harness/runs/run_ab%2Fcd');

  // reqStr throws synchronously — wrap in async so it surfaces as a rejection.
  await assert.rejects(async () => tool('pof_harness_run').handler({}, pof), /runId/);
});

test('pof_harness_run_diff proxies GET /api/harness/runs/diff?a&b and requires both', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_run_diff').handler({ a: 'run_1', b: 'run_2' }, pof);
  assert.match(calls[0].path, /^\/api\/harness\/runs\/diff\?/);
  assert.match(calls[0].path, /a=run_1/);
  assert.match(calls[0].path, /b=run_2/);

  await assert.rejects(async () => tool('pof_harness_run_diff').handler({ a: 'run_1' }, pof), /"b"/);
});
