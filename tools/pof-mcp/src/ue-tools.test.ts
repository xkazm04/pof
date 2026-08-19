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

// ── pof_package_history — the read an AGENT makes must be project-scoped ──────
//
// `build_history.project_id` is scoped own-plus-legacy: an unscoped read sees ONLY the
// unattributed `''` rows. This tool passed no project at all, so every headless query of
// build history answered from the pre-attribution set and could not see anything cooked
// since. Same regression class as wave 20 (insertBuild) and wave 23 (browser surface).

const HISTORY = '/api/packaging/history';

function historyRecorder() {
  return recorder({
    // action=scope is matched FIRST by longest-prefix intent; the recorder matches on
    // startsWith, so both land on the same key and we discriminate by query string.
    [HISTORY]: { builds: [], scope: { projectId: '', unscoped: true, totalRows: 6, legacyRows: 6, ownedRows: 0, foreignRows: 0, projects: [], distinctProjects: 0 } },
  });
}

test('pof_package_history declares projectPath in its input schema', () => {
  const schema = tool('pof_package_history').inputSchema as {
    properties: Record<string, unknown>;
    additionalProperties?: boolean;
  };
  assert.ok(
    'projectPath' in schema.properties,
    'the tool cannot be scoped at all: no project parameter is declared, so an agent literally cannot ask for its own builds',
  );
});

test('pof_package_history FORWARDS projectPath to the route (explicitly, never inferred)', async () => {
  const { pof, calls } = historyRecorder();
  await tool('pof_package_history').handler(
    { action: 'list', projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF' },
    pof,
  );
  const listCall = calls.find((c) => c.path.includes('action=list'));
  assert.ok(listCall, 'no list request was made');
  assert.match(
    listCall!.path,
    /projectPath=C%3A%2FUsers%2Fkazda%2FDocuments%2FUnreal\+Projects%2FPoF/,
    `the project was dropped on the way to the route: ${listCall!.path}`,
  );
});

test('pof_package_history states the scope it read and what it could not see', async () => {
  const { pof, calls } = historyRecorder();
  const out = await tool('pof_package_history').handler({ action: 'list' }, pof) as {
    result: unknown;
    scope: { scoped: boolean; projectPath: string | null; note: string; counts: unknown };
  };
  // The raw route payload survives unchanged beside the disclosure.
  assert.deepEqual((out.result as { builds: unknown[] }).builds, []);
  assert.equal(out.scope.scoped, false);
  assert.equal(out.scope.projectPath, null);
  assert.match(out.scope.note, /UNSCOPED/, 'an unscoped read must SAY it is unscoped');
  assert.match(out.scope.note, /legacy/i);
  // And the route's own scope counts ride along, so 0 builds reads as "another project
  // owns these" rather than "you have never built".
  assert.equal((out.scope.counts as { totalRows: number }).totalRows, 6);
  assert.ok(calls.some((c) => c.path.includes('action=scope')), 'the scope disclosure was never fetched');
});

test('pof_package_history reports a failed scope lookup instead of swallowing it', async () => {
  const calls: Array<{ path: string }> = [];
  const pof = {
    get: async (path: string) => {
      calls.push({ path });
      if (path.includes('action=scope')) throw new Error('backend exploded');
      return { builds: [] };
    },
    post: async () => ({}),
  } as unknown as import('./pofClient.js').PofClient;
  const out = await tool('pof_package_history').handler({ action: 'list', projectPath: 'C:/p' }, pof) as {
    scope: { scoped: boolean; counts: { error?: string } };
  };
  assert.equal(out.scope.scoped, true);
  assert.match(out.scope.counts.error ?? '', /backend exploded/);
});
