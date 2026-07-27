import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// ── Parity with the HTTP surface (the doc's claim, mechanically enforced) ─────
//
// `POST /api/harness` is the reference control surface. Its request-body type is
// the single source of truth for what a caller can steer, so this test READS
// that type out of the route file and asserts every field is reachable from the
// MCP tools. A new HTTP lever therefore fails here until MCP exposes it — the
// parity claim in docs/features/harness-llm-unreal/autonomous-builder.md cannot
// silently rot.

const ROUTE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/app/api/harness/route.ts',
);

/** Fields that are deliberately NOT tool inputs, each with its reason. */
const NOT_A_TOOL_INPUT: Record<string, string> = {
  action: 'the verb itself — expressed as tool identity (start) / the control tool\'s action enum',
};

function httpStartBodyFields(): string[] {
  const src = fs.readFileSync(ROUTE_PATH, 'utf-8');
  const m = src.match(/const body = await request\.json\(\) as \{([\s\S]*?)\n {2}\};/);
  assert.ok(m, 'could not locate the POST body type in the harness route — update this parity test');
  return [...m![1].matchAll(/^\s{4}(\w+)\??:/gm)].map((x) => x[1]);
}

test('MCP schema parity: every POST /api/harness body field is reachable from an MCP tool', () => {
  const fields = httpStartBodyFields();
  assert.ok(fields.length > 15, `expected the full HTTP body, parsed only ${fields.length} fields`);

  const startProps = Object.keys((tool('pof_harness_start').inputSchema as any).properties);
  const controlProps = Object.keys((tool('pof_harness_control').inputSchema as any).properties);
  const reachable = new Set([...startProps, ...controlProps]);

  const missing = fields.filter((f) => !reachable.has(f) && !(f in NOT_A_TOOL_INPUT));
  assert.deepEqual(missing, [], `MCP tools do not expose HTTP lever(s): ${missing.join(', ')}`);

  // The round-6/7 gaps specifically — assert them by name so a regression is legible.
  for (const f of ['ueVisual', 'statePath', 'fork']) {
    assert.ok(startProps.includes(f), `pof_harness_start must expose ${f}`);
  }
  assert.ok(controlProps.includes('statePath'), 'pof_harness_control must expose statePath (restart resume)');
});

test('pof_harness_start threads ueVisual, statePath and fork through to the POST body', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_start').handler(
    {
      projectPath: 'C:/proj', projectName: 'Proj', ueVersion: '5.8',
      ueVisual: true, statePath: 'C:/proj/.harness', fork: true,
    },
    pof,
  );
  const body = calls[0].body as Record<string, unknown>;
  assert.equal(body.ueVisual, true);
  assert.equal(body.statePath, 'C:/proj/.harness');
  assert.equal(body.fork, true);

  // ...and omits them entirely when not asked for (no accidental false/undefined).
  calls.length = 0;
  await tool('pof_harness_start').handler(
    { projectPath: 'C:/proj', projectName: 'Proj', ueVersion: '5.8', ueVisual: false, fork: false },
    pof,
  );
  const bare = calls[0].body as Record<string, unknown>;
  assert.ok(!('ueVisual' in bare));
  assert.ok(!('statePath' in bare));
  assert.ok(!('fork' in bare));
});

test('pof_harness_control carries statePath so a resume after a restart rehydrates', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_control').handler({ action: 'resume', statePath: 'C:/proj/.harness' }, pof);
  assert.deepEqual(calls[0].body, { action: 'resume', statePath: 'C:/proj/.harness' });

  calls.length = 0;
  await tool('pof_harness_control').handler({ action: 'pause' }, pof);
  assert.deepEqual(calls[0].body, { action: 'pause' });

  await assert.rejects(async () => tool('pof_harness_control').handler({ action: 'stop' }, pof), /pause/);
});

test('pof_harness_status feed reaches the events + progress GET actions', async () => {
  const { pof, calls } = recorder();
  await tool('pof_harness_status').handler({}, pof);
  assert.equal(calls[0].path, '/api/harness');

  calls.length = 0;
  await tool('pof_harness_status').handler({ feed: 'events' }, pof);
  assert.equal(calls[0].path, '/api/harness?action=events');

  calls.length = 0;
  await tool('pof_harness_status').handler({ feed: 'progress' }, pof);
  assert.equal(calls[0].path, '/api/harness?action=progress');

  await assert.rejects(async () => tool('pof_harness_status').handler({ feed: 'bogus' }, pof), /feed/);
});
