import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORY_TOOLS, projectStoryGraph, waitForWalk, LEAD_LABEL,
  STORY_WINDOW_DEFAULT, STORY_FINDINGS_DEFAULT, STORY_WALK_WAIT_MAX_S,
} from './tools/story.js';
import { TOOLS, groupOf } from './tools/index.js';
import type { ToolDef } from './tools/shared.js';
import { PofApiError, type PofClient } from './pofClient.js';

/**
 * The story family over a mocked PofClient: request paths and params, the bounded projection,
 * error pass-through, LEAD wording, unmeasured-is-absent, and import's write annotation.
 */

function tool(name: string): ToolDef {
  const t = STORY_TOOLS.find((x) => x.name === name);
  assert.ok(t, `tool ${name} not registered`);
  return t!;
}

interface Call { method: 'get' | 'post'; path: string; body?: unknown }

/** A client answering by route prefix; a function answer can throw. */
function mock(routes: Record<string, unknown | ((call: Call, n: number) => unknown)>) {
  const calls: Call[] = [];
  const hits: Record<string, number> = {};
  const answer = (call: Call) => {
    calls.push(call);
    const key = Object.keys(routes)
      .filter((k) => `${call.method.toUpperCase()} ${call.path}`.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`unmocked ${call.method} ${call.path}`);
    hits[key] = (hits[key] ?? 0) + 1;
    const v = routes[key];
    return typeof v === 'function' ? (v as (c: Call, n: number) => unknown)(call, hits[key]) : v;
  };
  const pof = {
    get: async (path: string) => answer({ method: 'get', path }),
    post: async (path: string, body: unknown) => answer({ method: 'post', path, body }),
  } as unknown as PofClient;
  return { pof, calls };
}

function bigGraph(n: number) {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `N${i}`, kind: 'beat', text: 'x'.repeat(40) }));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ id: `E${i}`, from: `N${i}`, to: `N${i + 1}`, kind: 'then' }));
  return {
    id: 'big::arc', project: 'big', graphId: 'arc', name: 'big/arc', revision: 2, hash: 'sha256:abc',
    format: 'pof.storygraph/1', nodeCount: n, edgeCount: n - 1, unknownKinds: [],
    graph: {
      format: 'pof.storygraph/1', project: 'big', graphId: 'arc', revision: 2,
      profile: { axes: [] }, variables: [{ id: 'v' }], entries: ['N0'], nodes, edges,
      endings: [{ node: `N${n - 1}` }], budgets: {},
      evidence: { runs: [{ runId: 'r' }], reach: Object.fromEntries(nodes.map((x) => [x.id, { all: 50 }])) },
    },
  };
}

// ── annotations & registration ───────────────────────────────────────────────

test('the four story tools are registered, in the story group, with honest annotations', () => {
  for (const n of ['pof_story_graph', 'pof_story_findings', 'pof_story_walk', 'pof_story_import']) {
    assert.ok(TOOLS.some((t) => t.name === n), `${n} missing from TOOLS`);
    assert.equal(groupOf(n), 'story');
  }
  assert.equal(tool('pof_story_graph').annotations.readOnlyHint, true);
  assert.equal(tool('pof_story_findings').annotations.readOnlyHint, true);
  assert.equal(tool('pof_story_walk').annotations.readOnlyHint, false, 'the walk starts a CPU-spending job on an operator-guarded route');
  const imp = tool('pof_story_import').annotations;
  assert.equal(imp.readOnlyHint, false, 'import writes the story store');
  assert.equal(imp.destructiveHint, true, 'a `replaced` import overwrites the stored document');
  assert.equal(imp.idempotentHint, true, 're-importing the same document answers unchanged');
  assert.equal(tool('pof_story_import').example, undefined, 'a write tool carries no static example');
  assert.equal(tool('pof_story_walk').example, undefined);
});

// ── pof_story_graph ──────────────────────────────────────────────────────────

test('pof_story_graph without graphId lists summaries, forwarding project', async () => {
  const { pof, calls } = mock({ 'GET /api/story/graphs': [{ graphId: 'a' }, { graphId: 'b' }] });
  const out = await tool('pof_story_graph').handler({ project: 'mage-arena' }, pof) as { count: number; scope: string };
  assert.equal(calls[0].path, '/api/story/graphs?project=mage-arena');
  assert.equal(out.count, 2);
  assert.match(out.scope, /mage-arena/);

  const bare = mock({ 'GET /api/story/graphs': [] });
  const b = await tool('pof_story_graph').handler({}, bare.pof) as { scope: string };
  assert.equal(bare.calls[0].path, '/api/story/graphs');
  assert.match(b.scope, /every story project/);
});

test('pof_story_graph with graphId reads the stored graph, URL-encoding the id', async () => {
  const small = { project: 'pof', graphId: 'arc x', graph: { nodes: [{ id: 'a' }], edges: [] } };
  const { pof, calls } = mock({ 'GET /api/story/graphs/': small });
  const out = await tool('pof_story_graph').handler({ graphId: 'arc x', project: 'pof' }, pof) as { truncated: boolean; graph: unknown };
  assert.equal(calls[0].path, '/api/story/graphs/arc%20x?project=pof');
  assert.equal(out.truncated, false, 'a small graph is returned whole — the projection must not cost more than it saves');
  assert.deepEqual(out.graph, small.graph);
});

test('a large graph is projected by default: header, counts, a window, truncated:true and how to page', async () => {
  const row = bigGraph(2000);
  const { pof } = mock({ 'GET /api/story/graphs/': row });
  const out = await tool('pof_story_graph').handler({ graphId: 'arc' }, pof) as any;
  assert.equal(out.truncated, true);
  assert.equal(out.counts.nodes, 2000);
  assert.equal(out.counts.edges, 1999);
  assert.equal(out.counts.evidenceReachRows, 2000);
  assert.equal(out.graph.nodes.length, STORY_WINDOW_DEFAULT);
  assert.equal(out.graph.edges.length, STORY_WINDOW_DEFAULT);
  assert.equal(out.graph.evidence, undefined, 'the reach map is counted, not dumped');
  assert.deepEqual(out.graph.entries, ['N0'], 'the header survives the projection');
  assert.equal(out.hash, 'sha256:abc', 'the stored summary survives the projection');
  assert.match(out.note, /nodeOffset/);
  assert.match(out.note, /full: true/);
  assert.equal(out.graph.variablesTruncated, undefined, 'a short variable list is kept whole');
  assert.ok(JSON.stringify(out).length < JSON.stringify(row).length / 10, 'the projection must actually be small');
});

test('the projection windows a long variable list and says so', () => {
  const row = bigGraph(2000) as any;
  row.graph.variables = Array.from({ length: 80 }, (_, i) => ({ id: `v${i}` }));
  const out = projectStoryGraph(row) as any;
  assert.equal(out.graph.variables.length, 50);
  assert.match(out.graph.variablesTruncated, /50 of 80/);
  assert.equal(out.counts.variables, 80);
});

test('the projection pages, clamps its limit, and full:true returns the whole document', async () => {
  const row = bigGraph(2000);
  const paged = projectStoryGraph(row, { nodeOffset: 100, nodeLimit: 10_000, edgeOffset: 1990, edgeLimit: 20 }) as any;
  assert.equal(paged.graph.nodes[0].id, 'N100');
  assert.equal(paged.window.nodes.limit, 500, 'the window limit is capped');
  assert.equal(paged.graph.edges.length, 9, 'a window past the end returns what exists');

  const { pof } = mock({ 'GET /api/story/graphs/': row });
  const full = await tool('pof_story_graph').handler({ graphId: 'arc', full: true }, pof) as any;
  assert.equal(full.truncated, false);
  assert.equal(full.graph.nodes.length, 2000);
  assert.ok(full.graph.evidence, 'full returns evidence too');
});

test('pof_story_graph surfaces the route error verbatim (404 / 409)', async () => {
  const { pof } = mock({
    'GET /api/story/graphs/': () => { throw new PofApiError('graph id arc exists in several projects (a, b); pass ?project=', 409); },
  });
  await assert.rejects(tool('pof_story_graph').handler({ graphId: 'arc' }, pof), /several projects \(a, b\); pass \?project=/);
});

// ── pof_story_findings ───────────────────────────────────────────────────────

function findingsPayload(n: number) {
  const findings = Array.from({ length: n }, (_, i) => ({
    code: i % 3 === 0 ? 'DANGLING_EDGE' : 'ORPHAN_NODE',
    altitude: 'structural',
    severity: i % 3 === 0 ? 'error' : 'warn',
    nodes: [`N${i}`],
    detail: `finding ${i}`,
  }));
  return { graphId: 'arc', project: 'pof', hash: 'sha256:h', findings, counts: { byCode: { X: n }, bySeverity: {} }, durationMs: 3 };
}

test('pof_story_findings calls the route with graphId + project and caps the list, saying what was cut', async () => {
  const { pof, calls } = mock({ 'GET /api/story/findings': findingsPayload(120) });
  const out = await tool('pof_story_findings').handler({ graphId: 'arc-pof-exemplars', project: 'pof' }, pof) as any;
  assert.equal(calls[0].path, '/api/story/findings?graphId=arc-pof-exemplars&project=pof');
  assert.equal(out.total, 120);
  assert.equal(out.returned, STORY_FINDINGS_DEFAULT);
  assert.match(out.truncated, /50 of 120/);
  assert.deepEqual(out.counts, { byCode: { X: 120 }, bySeverity: {} }, 'counts are the backend\'s own, over every finding');
  assert.equal(out.findings[0].severity, 'error', 'errors come first');
  assert.equal(out.hash, 'sha256:h');
  assert.equal(out.leadNote, undefined, 'structural findings are proofs, not leads');
  assert.equal(out.findings[0].label, undefined);
});

test('pof_story_findings filters by code/severity and returns everything when under the cap', async () => {
  const { pof } = mock({ 'GET /api/story/findings': findingsPayload(9) });
  const out = await tool('pof_story_findings').handler({ graphId: 'arc', severity: 'error' }, pof) as any;
  assert.equal(out.matched, 3);
  assert.equal(out.returned, 3);
  assert.equal(out.truncated, undefined);
  assert.ok(out.findings.every((f: { severity: string }) => f.severity === 'error'));
});

test('pof_story_findings labels any state-altitude finding a LEAD', async () => {
  const payload = findingsPayload(1);
  (payload.findings as unknown[]).push({ code: 'SOFTLOCK_LEAD', altitude: 'state', severity: 'warn', nodes: ['S'], detail: 'd', lead: { seed: 1 } });
  const { pof } = mock({ 'GET /api/story/findings': payload });
  const out = await tool('pof_story_findings').handler({ graphId: 'arc' }, pof) as any;
  const lead = out.findings.find((f: { code: string }) => f.code === 'SOFTLOCK_LEAD');
  assert.equal(lead.label, LEAD_LABEL);
  assert.match(out.leadNote, /LEAD/);
  assert.match(out.leadNote, /never a proven defect/);
});

test('pof_story_findings cuts a long finding node list, counts it, and full:true keeps it whole', async () => {
  const payload = findingsPayload(1);
  const many = Array.from({ length: 220 }, (_, i) => `W${i}`);
  (payload.findings as unknown[]).push({ code: 'VAR_WRITER_NOT_OWNER', altitude: 'structural', severity: 'warn', nodes: many, variables: ['v'], detail: 'v: 220 writing node(s) absent from writers[]' });
  const { pof } = mock({ 'GET /api/story/findings': payload });
  const out = await tool('pof_story_findings').handler({ graphId: 'arc', code: 'VAR_WRITER_NOT_OWNER' }, pof) as any;
  assert.equal(out.findings[0].nodes.length, 10);
  assert.equal(out.findings[0].nodesTotal, 220);
  assert.equal(out.findings[0].detail, 'v: 220 writing node(s) absent from writers[]', 'the detail is never cut');
  assert.match(out.listsNote, /nodesTotal/);
  const full = await tool('pof_story_findings').handler({ graphId: 'arc', code: 'VAR_WRITER_NOT_OWNER', full: true }, pof) as any;
  assert.equal(full.findings[0].nodes.length, 220);
  assert.equal(full.listsNote, undefined);
});

test('pof_story_findings requires graphId and surfaces route errors', async () => {
  const { pof } = mock({ 'GET /api/story/findings': () => { throw new PofApiError('story graph nope not found', 404); } });
  await assert.rejects(tool('pof_story_findings').handler({}, pof), /"graphId"/);
  await assert.rejects(tool('pof_story_findings').handler({ graphId: 'nope' }, pof), /story graph nope not found/);
});

// ── pof_story_walk ───────────────────────────────────────────────────────────

const LEAD_FINDING = {
  code: 'SOFTLOCK_LEAD', altitude: 'state', severity: 'warn', nodes: ['D'],
  detail: '3 of 100 walks stopped at D. A lead to reproduce, not a proven defect.',
  lead: { seed: 7, engine: 'pof-sampler/1', samples: 100, state: { x: 1 }, path: ['A', 'D'] },
};

function doneJob(over: Record<string, unknown> = {}) {
  return {
    jobId: 'w1', graphId: 'arc', project: 'pof', state: 'done', progress: { done: 100, total: 100 }, durationMs: 12,
    report: {
      engine: 'pof-sampler/1', graphId: 'arc', project: 'pof', revision: 1, seed: 7, samples: 100, maxSteps: 50,
      cohorts: [{ id: 'all', policy: 'uniform' }],
      // B was reached by no walk: it is ABSENT, and must stay absent.
      evidence: { runs: [{ runId: 'r1' }], reach: { A: { all: 100 }, D: { all: 3 } }, unit: 'percent of walks, per cohort (100 walks per cohort)' },
      outcomes: { all: { samples: 100, endings: { E: 97 }, stalled: 3, terminal: 0, truncated: 0 } },
      findings: [LEAD_FINDING, { ...LEAD_FINDING, code: 'NODE_NEVER_REACHED', severity: 'info', nodes: ['B'] }],
      domainEvents: [{}, {}],
      truncatedAt: {}, terminalAt: {},
      gradeable: true, untypedEdges: [], steps: 900,
      ...over,
    },
  };
}

test('pof_story_walk starts the job with the stated params and polls it to completion', async () => {
  const { pof, calls } = mock({
    'POST /api/story/walk': { jobId: 'w1', state: 'queued', hash: 'sha256:h', graphId: 'arc', project: 'pof' },
    'GET /api/story/walk/': (_c: Call, n: number) => (n < 2 ? { jobId: 'w1', graphId: 'arc', state: 'running', progress: { done: 50, total: 100 } } : doneJob()),
  });
  const cohorts = [{ id: 'all', policy: 'uniform' }];
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', project: 'pof', seed: 7, samples: 100, cohorts, waitSeconds: 5 }, pof) as any;
  assert.deepEqual(calls[0], { method: 'post', path: '/api/story/walk', body: { graphId: 'arc', project: 'pof', seed: 7, samples: 100, cohorts } });
  assert.equal(calls[1].path, '/api/story/walk/w1');
  assert.equal(out.state, 'done');
  assert.equal(out.wait.settled, true);
  assert.equal(out.gradeable, true, 'gradeable is always surfaced');
  assert.equal(out.hash, 'sha256:h');
});

test('pof_story_walk labels every finding a LEAD and never calls it a defect', async () => {
  const { pof } = mock({ 'POST /api/story/walk': { jobId: 'w1' }, 'GET /api/story/walk/': doneJob() });
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', waitSeconds: 1 }, pof) as any;
  assert.equal(out.leads.length, 2);
  for (const l of out.leads) {
    assert.equal(l.label, LEAD_LABEL);
    assert.ok(l.lead, 'the reproduction data rides along');
  }
  assert.match(out.leadNote, /LEAD/);
  assert.equal(out.findings, undefined, 'walker output is named leads, not findings');
  // The word "defect" may appear only negated ("not a proven defect").
  const text = JSON.stringify(out);
  for (const m of text.matchAll(/.{0,20}defect/g)) assert.match(m[0], /(not|never) a proven defect/, `"defect" used as a claim: ${m[0]}`);
  assert.deepEqual(out.leadCounts.byCode, { SOFTLOCK_LEAD: 1, NODE_NEVER_REACHED: 1 });
});

test('pof_story_walk omits uncovered nodes rather than printing 0, and passes an explicit measured 0 through untouched', async () => {
  const { pof } = mock({ 'POST /api/story/walk': { jobId: 'w1' }, 'GET /api/story/walk/': doneJob() });
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', waitSeconds: 1 }, pof) as any;
  assert.deepEqual(Object.keys(out.evidence.reach).sort(), ['A', 'D']);
  assert.equal('B' in out.evidence.reach, false, 'B was not covered by the run: it is UNMEASURED and absent, never filled with 0');
  assert.equal(out.evidence.measuredNodes, 2);
  assert.match(out.evidence.unmeasuredNote, /UNMEASURED/);
  assert.match(out.evidence.unmeasuredNote, /explicit 0 means covered and measured/);

  // A walker run now emits an explicit 0 for a covered node no walk reached: it must survive the projection.
  const withZero = doneJob({ evidence: { runs: [], reach: { A: { all: 40 }, Z: { all: 0 } }, unit: 'u' } });
  const m2 = mock({ 'POST /api/story/walk': { jobId: 'w2' }, 'GET /api/story/walk/': withZero });
  const out2 = await tool('pof_story_walk').handler({ graphId: 'arc', waitSeconds: 1 }, m2.pof) as any;
  assert.deepEqual(out2.evidence.reach.Z, { all: 0 }, 'a measured zero is a claim and is passed through, not dropped');
});

test('pof_story_walk surfaces gradeable:false with the reason', async () => {
  const { pof } = mock({ 'POST /api/story/walk': { jobId: 'w1' }, 'GET /api/story/walk/': doneJob({ gradeable: false, untypedEdges: ['e1', 'e2'] }) });
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', waitSeconds: 1 }, pof) as any;
  assert.equal(out.gradeable, false);
  assert.match(out.gradeableNote, /2 edge guard/);
});

test('pof_story_walk caps reach rows and leads, saying what was cut; full:true returns the report', async () => {
  const reach = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`N${i}`, { all: 1 }]));
  const findings = Array.from({ length: 80 }, () => LEAD_FINDING);
  const job = doneJob({ evidence: { runs: [], reach, unit: 'u' }, findings });
  const { pof } = mock({ 'POST /api/story/walk': { jobId: 'w1' }, 'GET /api/story/walk/': job });
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', waitSeconds: 1 }, pof) as any;
  assert.equal(Object.keys(out.evidence.reach).length, 100);
  assert.match(out.evidence.reachTruncated, /100 of 300/);
  assert.equal(out.leads.length, 50);
  assert.match(out.leadsTruncated, /50 of 80/);
  assert.equal(out.leadCounts.byCode.SOFTLOCK_LEAD, 80);

  const full = await tool('pof_story_walk').handler({ graphId: 'arc', jobId: 'w1', full: true, waitSeconds: 0 }, pof) as any;
  assert.equal(Object.keys(full.report.evidence.reach).length, 300);
  assert.ok(full.report.findings.every((f: { label: string }) => f.label === LEAD_LABEL));
});

test('pof_story_walk with a jobId polls without starting a new walk, and checks the graph', async () => {
  const { pof, calls } = mock({ 'GET /api/story/walk/': doneJob() });
  const out = await tool('pof_story_walk').handler({ graphId: 'arc', jobId: 'w1' }, pof) as any;
  assert.ok(calls.every((c) => c.method === 'get'), 'polling must not POST a new walk');
  assert.equal(out.state, 'done');
  await assert.rejects(tool('pof_story_walk').handler({ graphId: 'other', jobId: 'w1' }, pof), /is for graph "arc", not "other"/);
});

test('pof_story_walk surfaces route errors verbatim (start 409, poll 404)', async () => {
  const start = mock({ 'POST /api/story/walk': () => { throw new PofApiError('graph id arc exists in several projects (a, b); pass project', 409); } });
  await assert.rejects(tool('pof_story_walk').handler({ graphId: 'arc' }, start.pof), /pass project/);
  const poll = mock({ 'GET /api/story/walk/': () => { throw new PofApiError('walk job w9 not found', 404); } });
  await assert.rejects(tool('pof_story_walk').handler({ graphId: 'arc', jobId: 'w9' }, poll.pof), /walk job w9 not found/);
});

test('waitForWalk: an expired wait returns the last real state, unsettled, never a verdict', async () => {
  let t = 0;
  const now = () => t;
  let polls = 0;
  const out = await waitForWalk(async () => { polls += 1; t += 1000; return { state: 'running' }; }, 3, { pollMs: 1, now });
  assert.equal(out.wait.settled, false);
  assert.equal(out.wait.state, 'running');
  assert.match(String(out.wait.note), /NOT a result/);
  assert.ok(polls >= 2 && polls <= 4, `bounded polling (got ${polls})`);

  const clamped = await waitForWalk(async () => ({ state: 'done' }), 10_000, { pollMs: 1 });
  assert.equal(clamped.wait.budgetSeconds, STORY_WALK_WAIT_MAX_S);
  assert.ok(clamped.wait.clamped);
  assert.equal(clamped.wait.polls, 1, 'stops at the first terminal read');

  const once = await waitForWalk(async () => ({ state: 'queued' }), 0, { pollMs: 1 });
  assert.equal(once.wait.polls, 1, 'waitSeconds 0 reads once and returns');
});

// ── pof_story_import ─────────────────────────────────────────────────────────

const DOC = { format: 'pof.storygraph/1', project: 'pof', graphId: 'arc', revision: 1, nodes: [], edges: [] };

test('pof_story_import POSTs the document object and surfaces status + unknownKinds', async () => {
  const { pof, calls } = mock({
    'POST /api/story/graphs': { status: 'created', graph: { graphId: 'arc', revision: 1 }, unknownKinds: [{ kind: 'vignette', on: 'node' }] },
  });
  const out = await tool('pof_story_import').handler({ document: DOC }, pof) as any;
  assert.deepEqual(calls[0], { method: 'post', path: '/api/story/graphs', body: DOC });
  assert.equal(out.status, 'created');
  assert.equal(out.unknownKinds.length, 1);
  assert.match(out.unknownKindsNote, /unknown node\/edge kind/);
});

test('pof_story_import accepts the document as a JSON string', async () => {
  const { pof, calls } = mock({ 'POST /api/story/graphs': { status: 'unchanged', graph: {}, unknownKinds: [] } });
  const out = await tool('pof_story_import').handler({ document: JSON.stringify(DOC) }, pof) as any;
  assert.deepEqual(calls[0].body, DOC);
  assert.equal(out.status, 'unchanged');
  assert.equal(out.unknownKindsNote, undefined);
});

test('pof_story_import passes 400 / 409 reasons through verbatim', async () => {
  const conflict = mock({ 'POST /api/story/graphs': () => { throw new PofApiError('revision 1 is older than the stored revision 3', 409); } });
  await assert.rejects(tool('pof_story_import').handler({ document: DOC }, conflict.pof), /revision 1 is older than the stored revision 3/);

  const bad = mock({ 'POST /api/story/graphs': () => { throw new PofApiError('format: Invalid input: expected "pof.storygraph/1"', 400); } });
  await assert.rejects(
    tool('pof_story_import').handler({ document: '{not json' }, bad.pof),
    (e: Error) => /expected "pof.storygraph\/1"/.test(e.message) && /not valid JSON/.test(e.message),
  );
  await assert.rejects(tool('pof_story_import').handler({}, bad.pof), /"document"/);
});
