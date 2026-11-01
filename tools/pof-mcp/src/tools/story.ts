import {
  type ToolDef,
  reqStr, optStr, optNum, optBool, qs, obj, readOnly, writes } from './shared.js';

/**
 * The story family: read, check, walk and import `pof.storygraph/1` decision graphs
 * (docs/architecture/storygraph-standard.md). A thin adapter over `/api/story/*`.
 *
 * Three properties this family keeps.
 *
 * 1. **Bounded by default, never lossy without a way back.** A stored graph can run to 10k nodes
 *    and several MB of JSON (synthetic-ashfall/arc-the-long-ash: 6.3 MB). Pouring that into an
 *    agent's transcript costs it on every later turn, so `pof_story_graph` returns a projection —
 *    the header, the counts and a window of nodes/edges — and says how to get more (`nodeOffset`,
 *    `edgeOffset`, `full: true`). A graph small enough to read whole is returned whole: the
 *    projection is only applied when it is smaller than what it replaces.
 * 2. **State findings are LEADS.** The walker's findings are state-altitude samples, never proven
 *    defects; every one comes back labelled `LEAD` beside the reproduction data it carries.
 * 3. **Absent is unmeasured.** A node a walk never reached is absent from `evidence.reach`, and it
 *    stays absent here — nothing is filled in with 0.
 *
 * The `project` here is the STORY project slug the graph declares (`pof`, `mage-arena`), not a UE
 * project path. Story rows are keyed `(project, graphId)` by exact match: an unscoped read spans
 * every project (no legacy-only degradation), and an id two projects hold is a 409 naming them.
 */

/** Below this serialized size a graph is returned whole — the projection would not pay for itself. */
export const STORY_GRAPH_WHOLE_MAX_CHARS = 40_000;
export const STORY_WINDOW_DEFAULT = 25;
export const STORY_WINDOW_MAX = 500;
export const STORY_FINDINGS_DEFAULT = 50;
export const STORY_FINDINGS_MAX = 500;
/** Node ids / path steps kept per finding by default; one variable finding can name 200+ nodes. */
export const STORY_FINDING_NODES_DEFAULT = 10;
/** Variables kept in a projected graph header. */
export const STORY_VARIABLES_DEFAULT = 50;
/** A lead's own node list is kept to this length in the bounded walk output; `lead.path` (the reproduction) is never cut. */
export const STORY_LEAD_PATH_DEFAULT = 20;
/** Reach rows (one per measured node) returned by default from a finished walk. */
export const STORY_REACH_DEFAULT = 100;
/** Ceiling on a caller-requested walk wait — a tool that can hang a session forever is a hazard. */
export const STORY_WALK_WAIT_MAX_S = 300;
export const STORY_WALK_WAIT_DEFAULT_S = 30;
export const STORY_WALK_POLL_MS = 1000;

/** The label every state-altitude finding carries out of this family. */
export const LEAD_LABEL = 'LEAD';
export const LEAD_NOTE =
  'Every walker finding is a LEAD: a sampled state to reproduce (seed, engine, samples, state, path), never a proven defect.';
const UNMEASURED_NOTE =
  'A node absent from reach was reached by no walk in this sample — it is UNMEASURED, never 0. Reach values are percent of walks per cohort.';

const PROJECT_PARAM = {
  type: 'string',
  description:
    'Story project slug the graph belongs to (e.g. "pof", "mage-arena") — the `project` field of the storygraph document, NOT a UE project path. Exact match. Omit to search every project; a graphId held by several projects is then a 409 that names them.',
} as const;

function clampInt(v: number | undefined, dflt: number, min: number, max: number): number {
  if (v == null || !Number.isFinite(v)) return dflt;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Map a finding to its outbound shape: state-altitude findings are labelled LEAD. */
function labelFinding(f: unknown): unknown {
  if (!isObj(f)) return f;
  return f.altitude === 'state' || f.lead != null ? { label: LEAD_LABEL, ...f } : f;
}

/**
 * Bound one finding's node list and witness path, counting what was cut. Only list members are
 * dropped; the finding itself, its code, detail and lead are kept whole.
 */
export function trimFinding(f: unknown, max = STORY_FINDING_NODES_DEFAULT): unknown {
  if (!isObj(f)) return f;
  const out: Record<string, unknown> = { ...f };
  for (const key of ['nodes', 'path'] as const) {
    const list = f[key];
    if (Array.isArray(list) && list.length > max) {
      out[key] = list.slice(0, max);
      out[`${key}Total`] = list.length;
    }
  }
  return out;
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warn: 1, info: 2 };
const bySeverity = (a: unknown, b: unknown) =>
  (SEVERITY_RANK[String((a as { severity?: unknown })?.severity)] ?? 3)
  - (SEVERITY_RANK[String((b as { severity?: unknown })?.severity)] ?? 3);

// ── pof_story_graph ──────────────────────────────────────────────────────────

/**
 * Project a stored graph row to something an agent can afford to read. Returns the row
 * untouched when it is small enough, so the transform never costs more than it saves.
 */
export function projectStoryGraph(
  row: unknown,
  opts: { nodeOffset?: number; nodeLimit?: number; edgeOffset?: number; edgeLimit?: number } = {},
): unknown {
  if (!isObj(row) || !isObj(row.graph)) return row;
  if (JSON.stringify(row).length <= STORY_GRAPH_WHOLE_MAX_CHARS) {
    return { ...row, truncated: false };
  }
  const g = row.graph;
  const nodes = arr(g.nodes);
  const edges = arr(g.edges);
  const nodeOffset = clampInt(opts.nodeOffset, 0, 0, Number.MAX_SAFE_INTEGER);
  const nodeLimit = clampInt(opts.nodeLimit, STORY_WINDOW_DEFAULT, 0, STORY_WINDOW_MAX);
  const edgeOffset = clampInt(opts.edgeOffset, 0, 0, Number.MAX_SAFE_INTEGER);
  const edgeLimit = clampInt(opts.edgeLimit, STORY_WINDOW_DEFAULT, 0, STORY_WINDOW_MAX);
  const nodeWindow = nodes.slice(nodeOffset, nodeOffset + nodeLimit);
  const edgeWindow = edges.slice(edgeOffset, edgeOffset + edgeLimit);
  const evidence = isObj(g.evidence) ? g.evidence : undefined;
  const { graph: _graph, ...summary } = row;

  // The header is everything but the bulk arrays: small, and what a reader needs to orient.
  const { nodes: _n, edges: _e, evidence: _ev, ...header } = g;
  const variables = arr(g.variables);
  if (variables.length > STORY_VARIABLES_DEFAULT) {
    header.variables = variables.slice(0, STORY_VARIABLES_DEFAULT);
    header.variablesTruncated = `${STORY_VARIABLES_DEFAULT} of ${variables.length} variables shown — full: true returns them all`;
  }
  return {
    ...summary,
    truncated: true,
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      variables: arr(g.variables).length,
      endings: arr(g.endings).length,
      entries: arr(g.entries).length,
      ...(evidence ? { evidenceReachRows: isObj(evidence.reach) ? Object.keys(evidence.reach).length : 0, evidenceRuns: arr(evidence.runs).length } : {}),
    },
    window: {
      nodes: { offset: nodeOffset, limit: nodeLimit, returned: nodeWindow.length, total: nodes.length },
      edges: { offset: edgeOffset, limit: edgeLimit, returned: edgeWindow.length, total: edges.length },
    },
    graph: { ...header, nodes: nodeWindow, edges: edgeWindow },
    note:
      `Bounded projection: the header, counts and nodes ${nodeOffset}-${nodeOffset + nodeWindow.length} of ${nodes.length}, `
      + `edges ${edgeOffset}-${edgeOffset + edgeWindow.length} of ${edges.length}`
      + (evidence ? '; `evidence` is omitted (its runs and reach rows are counted above)' : '')
      + `. Page with nodeOffset/edgeOffset (limits up to ${STORY_WINDOW_MAX}), or pass full: true for the whole stored document `
      + `(${JSON.stringify(row).length} chars).`,
  };
}

// ── pof_story_walk ───────────────────────────────────────────────────────────

const WALK_TERMINAL = new Set(['done', 'failed']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stateOf(job: unknown): string | null {
  return isObj(job) && typeof job.state === 'string' ? job.state : null;
}

/**
 * Shape a walk job for an agent: the verdict-bearing parts of the report up front, every finding
 * labelled LEAD, the reach map bounded (with the measured-node count), unmeasured nodes absent.
 */
export function shapeWalkJob(job: unknown, opts: { findingsLimit?: number; reachLimit?: number; full?: boolean } = {}): unknown {
  if (!isObj(job)) return job;
  const report = isObj(job.report) ? job.report : undefined;
  const base: Record<string, unknown> = {
    jobId: job.jobId,
    graphId: job.graphId,
    project: job.project,
    state: job.state,
    progress: job.progress,
    ...(job.error != null ? { error: job.error } : {}),
    ...(job.durationMs != null ? { durationMs: job.durationMs } : {}),
  };
  if (!report) return base;

  const findings = arr(report.findings).map(labelFinding);
  const counts: { byCode: Record<string, number>; bySeverity: Record<string, number> } = { byCode: {}, bySeverity: {} };
  for (const f of findings) {
    if (!isObj(f)) continue;
    const c = String(f.code); const s = String(f.severity);
    counts.byCode[c] = (counts.byCode[c] ?? 0) + 1;
    counts.bySeverity[s] = (counts.bySeverity[s] ?? 0) + 1;
  }
  const evidence = isObj(report.evidence) ? report.evidence : {};
  const reach = isObj(evidence.reach) ? evidence.reach : {};
  const reachIds = Object.keys(reach);

  if (opts.full) {
    return {
      ...base,
      gradeable: report.gradeable,
      leadNote: LEAD_NOTE,
      unmeasuredNote: UNMEASURED_NOTE,
      report: { ...report, findings },
    };
  }

  const findingsLimit = clampInt(opts.findingsLimit, STORY_FINDINGS_DEFAULT, 0, STORY_FINDINGS_MAX);
  const reachLimit = clampInt(opts.reachLimit, STORY_REACH_DEFAULT, 0, Number.MAX_SAFE_INTEGER);
  const shownFindings = [...findings].sort(bySeverity).slice(0, findingsLimit).map((f) => trimFinding(f, STORY_LEAD_PATH_DEFAULT));
  // Only nodes the walker MEASURED are keys of reach; slicing the keys never invents a 0.
  const shownReach = Object.fromEntries(reachIds.slice(0, reachLimit).map((id) => [id, reach[id]]));
  const untyped = arr(report.untypedEdges);

  return {
    ...base,
    gradeable: report.gradeable,
    ...(report.gradeable === false
      ? { gradeableNote: `NOT gradeable at state altitude: ${untyped.length} edge guard(s) hold an untyped (expr) atom, which the walker reads optimistically.` }
      : {}),
    engine: report.engine,
    revision: report.revision,
    seed: report.seed,
    samples: report.samples,
    maxSteps: report.maxSteps,
    cohorts: report.cohorts,
    outcomes: report.outcomes,
    leadNote: LEAD_NOTE,
    leadCounts: counts,
    leads: shownFindings,
    ...(findings.length > shownFindings.length
      ? { leadsTruncated: `${shownFindings.length} of ${findings.length} leads shown (error, then warn, then info); the cut ones are counted in leadCounts. Raise findingsLimit (max ${STORY_FINDINGS_MAX}) or pass full: true.` }
      : {}),
    evidence: {
      runs: evidence.runs,
      unit: evidence.unit,
      measuredNodes: reachIds.length,
      reach: shownReach,
      ...(reachIds.length > reachLimit
        ? { reachTruncated: `${reachLimit} of ${reachIds.length} measured nodes shown. Raise reachLimit or pass full: true.` }
        : {}),
      unmeasuredNote: UNMEASURED_NOTE,
    },
    untypedEdges: untyped.length,
    domainEvents: arr(report.domainEvents).length,
    truncatedAt: report.truncatedAt,
    terminalAt: report.terminalAt,
    steps: report.steps,
  };
}

/**
 * Poll `read` until the walk settles (done/failed) or the budget runs out. Same honesty rules as
 * the build wait (ue.ts → waitForBuild): a wait that runs out returns the LAST REAL state and
 * `settled: false`, never a verdict; a failed read is surfaced at once, not slept on.
 */
export async function waitForWalk(
  read: () => Promise<unknown>,
  requestedSeconds: number,
  opts: { pollMs?: number; now?: () => number } = {},
): Promise<{ job: unknown; wait: Record<string, unknown> }> {
  const pollMs = opts.pollMs ?? STORY_WALK_POLL_MS;
  const now = opts.now ?? Date.now;
  const budgetS = Math.min(Math.max(0, requestedSeconds), STORY_WALK_WAIT_MAX_S);
  const startedAt = now();
  const deadline = startedAt + budgetS * 1000;
  let job: unknown;
  let polls = 0;
  let state = stateOf(job);

  while (!(state != null && WALK_TERMINAL.has(state)) && (polls === 0 || now() < deadline)) {
    if (polls > 0) await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
    polls += 1;
    job = await read(); // a 404 (unknown/evicted job) throws and is surfaced by the caller
    state = stateOf(job);
    if (budgetS === 0) break;
  }

  const settled = state != null && WALK_TERMINAL.has(state);
  return {
    job,
    wait: {
      requestedSeconds,
      budgetSeconds: budgetS,
      ...(budgetS < requestedSeconds ? { clamped: `waitSeconds was capped at ${STORY_WALK_WAIT_MAX_S}` } : {}),
      waitedMs: now() - startedAt,
      polls,
      settled,
      state,
      note: settled
        ? `walk reached the terminal state "${state}"`
        : `walk is still "${state ?? 'unknown'}" — this is NOT a result. Call pof_story_walk again with this jobId (and waitSeconds) to keep waiting.`,
    },
  };
}

// ── pof_story_import ─────────────────────────────────────────────────────────

function documentArg(args: Record<string, unknown>): { body: unknown; parseError?: string } {
  const v = args.document;
  if (v == null) throw new Error('"document" (a pof.storygraph/1 object or its JSON string) is required');
  if (typeof v !== 'string') return { body: v };
  try {
    return { body: JSON.parse(v) };
  } catch (e) {
    // Forwarded as-is: the route is the validator, and its own refusal is surfaced verbatim.
    return { body: v, parseError: e instanceof Error ? e.message : String(e) };
  }
}

// ── the tools ────────────────────────────────────────────────────────────────

/** Story decision graphs: read, structural findings, the bounded walker, import. */
export const STORY_TOOLS: ToolDef[] = [
  {
    name: 'pof_story_graph',
    annotations: readOnly('Story graph'),
    description:
      'Read stored pof.storygraph/1 decision graphs. Without graphId: the stored graph summaries (project, graphId, revision, hash, node/edge counts — no bodies). With graphId: that graph — as a BOUNDED projection by default when it is large (header, counts, a window of nodes and edges, `truncated: true` and how to page), because a stored graph can be 10k nodes and several MB. Page with nodeOffset/edgeOffset, or pass full: true for the whole document. A small graph comes back whole with `truncated: false`.',
    inputSchema: obj({
      project: PROJECT_PARAM,
      graphId: { type: 'string', description: 'Graph to read. Omit to list summaries.' },
      full: { type: 'boolean', description: 'true returns the whole stored document unprojected (can be MBs). Default false.' },
      nodeOffset: { type: 'number', description: 'First node index of the window (default 0).' },
      nodeLimit: { type: 'number', description: `Nodes in the window (default ${STORY_WINDOW_DEFAULT}, max ${STORY_WINDOW_MAX}).` },
      edgeOffset: { type: 'number', description: 'First edge index of the window (default 0).' },
      edgeLimit: { type: 'number', description: `Edges in the window (default ${STORY_WINDOW_DEFAULT}, max ${STORY_WINDOW_MAX}).` },
    }),
    example: { args: {}, note: 'Lists every stored graph summary across projects; an empty store answers with an empty list.' },
    handler: async (args, pof) => {
      const project = optStr(args, 'project');
      const graphId = optStr(args, 'graphId');
      if (!graphId) {
        const graphs = await pof.get<unknown>(`/api/story/graphs${qs({ project })}`);
        return {
          graphs,
          count: arr(graphs).length,
          scope: project
            ? `graphs of story project "${project}" only`
            : 'every story project (no project given) — pass project to narrow',
        };
      }
      const row = await pof.get<unknown>(`/api/story/graphs/${encodeURIComponent(graphId)}${qs({ project })}`);
      if (optBool(args, 'full') === true) return { ...(isObj(row) ? row : { row }), truncated: false };
      return projectStoryGraph(row, {
        nodeOffset: optNum(args, 'nodeOffset'),
        nodeLimit: optNum(args, 'nodeLimit'),
        edgeOffset: optNum(args, 'edgeOffset'),
        edgeLimit: optNum(args, 'edgeLimit'),
      });
    },
  },
  {
    name: 'pof_story_findings',
    annotations: readOnly('Story structural findings'),
    description:
      "Run the structural pass (storygraph standard §8) over one STORED graph: dangling edges, orphans, unreachable endings, undeclared terminals, variable reaching-writes, false choices, text budgets. Returns counts by code and severity plus the findings (errors first, capped — the response says what was cut), pinned to the stored content hash. Filter with code / severity. These are structural PROOFS; the state-altitude LEADS come from pof_story_walk.",
    inputSchema: obj({
      graphId: { type: 'string', description: 'Stored graph to check.' },
      project: PROJECT_PARAM,
      code: { type: 'string', description: 'Only findings with this code (e.g. ORPHAN_NODE). Counts still cover every finding.' },
      severity: { type: 'string', enum: ['error', 'warn', 'info'], description: 'Only findings of this severity. Counts still cover every finding.' },
      limit: { type: 'number', description: `Findings to return (default ${STORY_FINDINGS_DEFAULT}, max ${STORY_FINDINGS_MAX}).` },
      full: { type: 'boolean', description: `true keeps every node id and path step on each finding (by default each list is cut to ${STORY_FINDING_NODES_DEFAULT} with a nodesTotal/pathTotal count). The finding cap still applies.` },
    }, ['graphId']),
    handler: async (args, pof) => {
      const graphId = reqStr(args, 'graphId');
      const project = optStr(args, 'project');
      const res = await pof.get<unknown>(`/api/story/findings${qs({ graphId, project })}`);
      if (!isObj(res)) return res;
      const all = arr(res.findings).map(labelFinding);
      const code = optStr(args, 'code');
      const severity = optStr(args, 'severity');
      const filtered = all.filter((f) => isObj(f) && (!code || f.code === code) && (!severity || f.severity === severity));
      const limit = clampInt(optNum(args, 'limit'), STORY_FINDINGS_DEFAULT, 0, STORY_FINDINGS_MAX);
      const full = optBool(args, 'full') === true;
      const sorted = [...filtered].sort(bySeverity).slice(0, limit);
      const shown = full ? sorted : sorted.map((f) => trimFinding(f));
      const listsCut = !full && shown.some((f) => isObj(f) && (f.nodesTotal != null || f.pathTotal != null));
      const hasLeads = all.some((f) => isObj(f) && f.label === LEAD_LABEL);
      return {
        graphId: res.graphId,
        project: res.project,
        hash: res.hash,
        durationMs: res.durationMs,
        total: all.length,
        counts: res.counts,
        ...(code || severity ? { filter: { ...(code ? { code } : {}), ...(severity ? { severity } : {}) }, matched: filtered.length } : {}),
        returned: shown.length,
        ...(filtered.length > shown.length
          ? { truncated: `${shown.length} of ${filtered.length} findings shown (error, then warn, then info); every finding is counted in counts. Narrow with code/severity or raise limit (max ${STORY_FINDINGS_MAX}).` }
          : {}),
        ...(listsCut ? { listsNote: `Some findings name more than ${STORY_FINDING_NODES_DEFAULT} nodes: their nodes/path lists are cut, with nodesTotal/pathTotal giving the real length. full: true keeps them whole.` } : {}),
        ...(hasLeads ? { leadNote: LEAD_NOTE } : {}),
        findings: shown,
      };
    },
  },
  {
    name: 'pof_story_walk',
    // Starts a background job that spends server CPU (the route is operator-guarded). It writes
    // nothing to the DB, but each call creates a new in-memory job — not a read.
    annotations: writes('Walk a story graph'),
    description:
      'Run the bounded walker (storygraph standard §8 state pass / §9a) over one STORED graph as a background job, and wait for it up to waitSeconds (default 30, max 300). Returns the job: state, progress, `gradeable`, per-cohort outcomes, LEADS and the reach evidence. Every finding is a LEAD — a sampled state to reproduce (seed, engine, samples, state, path), never a proven defect. A node no walk reached is ABSENT from reach (unmeasured, never 0). If the wait runs out the job is still running: call again with the same graphId plus `jobId` to keep waiting instead of starting a new walk. Bounded output by default (leads capped, reach rows capped); full: true returns the whole report.',
    inputSchema: obj({
      graphId: { type: 'string', description: 'Stored graph to walk (also required when polling, and checked against the job).' },
      project: PROJECT_PARAM,
      jobId: { type: 'string', description: 'Poll this existing walk job instead of starting a new one.' },
      seed: { type: 'number', description: 'Integer seed (default 1). Same seed + samples + cohorts = same report.' },
      samples: { type: 'number', description: 'Walks per cohort (route default 2000, max 20000).' },
      cohorts: {
        type: 'array',
        description: '1-8 sampling cohorts: [{id, policy: "uniform"|"weighted", weights?: {optionId: weight}}]. Default: the walker\'s own cohort.',
        items: { type: 'object' },
      },
      waitSeconds: { type: 'number', description: `Wait up to this many seconds (max ${STORY_WALK_WAIT_MAX_S}, default ${STORY_WALK_WAIT_DEFAULT_S}) for the walk to finish. 0 returns the job at once.` },
      findingsLimit: { type: 'number', description: `Leads to return (default ${STORY_FINDINGS_DEFAULT}, max ${STORY_FINDINGS_MAX}); all are counted.` },
      reachLimit: { type: 'number', description: `Measured reach rows to return (default ${STORY_REACH_DEFAULT}).` },
      full: { type: 'boolean', description: 'true returns the whole walk report (every lead, every measured reach row, domain events) instead of the bounded view. Unmeasured nodes stay absent either way.' },
    }, ['graphId']),
    handler: async (args, pof) => {
      const graphId = reqStr(args, 'graphId');
      const project = optStr(args, 'project');
      const waitSeconds = optNum(args, 'waitSeconds') ?? STORY_WALK_WAIT_DEFAULT_S;
      const shapeOpts = { findingsLimit: optNum(args, 'findingsLimit'), reachLimit: optNum(args, 'reachLimit'), full: optBool(args, 'full') === true };
      let jobId = optStr(args, 'jobId');
      let started: unknown;

      if (!jobId) {
        const cohorts = Array.isArray(args.cohorts) ? args.cohorts : undefined;
        started = await pof.post<unknown>('/api/story/walk', {
          graphId,
          ...(project ? { project } : {}),
          ...(optNum(args, 'seed') !== undefined ? { seed: optNum(args, 'seed') } : {}),
          ...(optNum(args, 'samples') !== undefined ? { samples: optNum(args, 'samples') } : {}),
          ...(cohorts ? { cohorts } : {}),
        });
        jobId = isObj(started) && typeof started.jobId === 'string' ? started.jobId : undefined;
        if (!jobId) {
          return { started, settled: false, note: 'the walk route answered without a jobId — nothing to poll; the response is returned as-is' };
        }
      }

      const id = jobId;
      const read = () => pof.get<unknown>(`/api/story/walk/${encodeURIComponent(id)}`);
      const { job, wait } = await waitForWalk(read, waitSeconds);
      if (isObj(job) && typeof job.graphId === 'string' && job.graphId !== graphId) {
        throw new Error(`walk job ${id} is for graph "${job.graphId}", not "${graphId}"`);
      }
      return {
        ...(shapeWalkJob(job, shapeOpts) as Record<string, unknown>),
        ...(isObj(started) ? { hash: started.hash } : {}),
        wait,
      };
    },
  },
  {
    name: 'pof_story_import',
    // Writes the story store. `replaced` overwrites the stored document for (project, graphId) at a
    // higher revision, so it is destructive; re-importing the same document answers `unchanged`.
    annotations: writes('Import a story graph', { destructive: true, idempotent: true }),
    description:
      'Import one pof.storygraph/1 document into the story store (POST /api/story/graphs). `document` is the document object or its JSON string; its own `project` and `graphId` say where it lands. Returns `status` (created / replaced / unchanged), the stored summary and `unknownKinds` (node/edge kinds outside the standard, stored as written). Refusals come back verbatim: 400 for a document the schema rejects or a contentHash that does not match, 409 for an older revision or a re-used revision number with different content. Operator-guarded on the backend.',
    inputSchema: obj({
      document: {
        type: 'object',
        description: 'The pof.storygraph/1 document (format, project, graphId, revision, profile, variables, entries, nodes, edges, endings, budgets, …). A JSON string of it is also accepted.',
      },
    }, ['document']),
    handler: async (args, pof) => {
      const { body, parseError } = documentArg(args);
      let res: unknown;
      try {
        res = await pof.post<unknown>('/api/story/graphs', body);
      } catch (e) {
        if (parseError && e instanceof Error) {
          e.message = `${e.message} (the document string was not valid JSON: ${parseError})`;
        }
        throw e;
      }
      if (!isObj(res)) return res;
      const unknownKinds = arr(res.unknownKinds);
      return {
        status: res.status,
        graph: res.graph,
        unknownKinds,
        ...(unknownKinds.length
          ? { unknownKindsNote: `${unknownKinds.length} unknown node/edge kind(s) were accepted and stored as written; validation treats them per the standard's unknown-kind rule.` }
          : {}),
      };
    },
  },
];
