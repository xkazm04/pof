import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from './tools/index.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';

/**
 * ── The guard that makes an EIGHTH scope regression impossible to land silently ──
 *
 * PoF scopes its project-owned tables with ONE own-plus-legacy rule
 * (`src/lib/project-id.ts` → `projectScopeSql`): a NAMED project sees its own rows PLUS
 * the unattributed legacy rows (`project_id = ''`); an UNSCOPED caller sees ONLY the
 * legacy set. That rule is correct. What keeps going wrong is the CALLERS.
 *
 * Seven instances of the same defect have now shipped: a table gains a project column,
 * the writers start stamping it, and some reader keeps calling with no project — which
 * silently degrades from "everything" to "the legacy rows", and after a backfill that is
 * ZERO rows. Wave 20 (insertBuild), wave 23 (the Builds tab), wave 24 (pof_package_history),
 * and this lot (pof_feature_matrix / _all / _aggregate / pof_gdd_compliance / pof_gdd —
 * 0 of 165 rows on the live DB) are all the same bug wearing different clothes.
 *
 * So this test does not check five tools. It enumerates EVERY registered pof-mcp tool,
 * drives each handler against a recording client, resolves every route it hits against the
 * app's real `src/app/api` tree, and asserts:
 *
 *   1. every tool actually reaches a route (an unprobeable handler is a blind spot);
 *   2. every route it reaches RESOLVES to a real `route.ts` (a typo'd path is a finding);
 *   3. every route reached is CLASSIFIED in `ROUTE_SCOPE` — a new tool or a new route
 *      forces a deliberate scoped/unscoped verdict rather than defaulting to silence;
 *   4. a route classified `scoped: false` may NOT use the app's scoping primitives —
 *      static cross-check against the route source, so the map cannot lie in the
 *      dangerous direction;
 *   5. every call to a `scoped: true` route CARRIES a project, and the tool DECLARES one
 *      in its input schema (a tool with no project parameter cannot be scoped even
 *      deliberately — which is exactly how these five shipped).
 *
 * The probe always supplies a project. It answers "when an agent scopes this tool, does the
 * project reach the route?" — the unscoped-disclosure behaviour is pinned separately in
 * design-tools.test.ts and ue-tools.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** <repo>/tools/pof-mcp/{src,dist}/… → <repo>. Same depth compiled or not. */
const REPO = path.resolve(HERE, '..', '..', '..');
const API_DIR = path.join(REPO, 'src', 'app', 'api');

const PROBE_PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

/** Every spelling of "the caller stated a project" the app accepts. */
const PROJECT_KEY = /^project(Id|Path)?$/;

/**
 * The app's own scoping primitives. A route that names one of these filters a DB read by
 * project — it is unambiguously in the class this guard exists for.
 */
const SCOPING_PRIMITIVES = /\b(normalizeProjectId|projectScopeSql|isInProjectScope)\b/;

/**
 * Route → is this read/write scoped by project?
 *
 * Keyed by the route's directory under `src/app/api` (dynamic segments included, e.g.
 * `harness/runs/[id]`), so one entry covers every id a tool passes.
 *
 * `scoped: true` means the route filters rows by the caller's project — a call without one
 * gets the legacy set, not everything. `scoped: false` means `projectPath`/`projectId`
 * appears in the route for some OTHER reason (which .uproject to build, which folder to
 * scan, which project a harness run targets) and is cross-checked against the primitives
 * above so it cannot be used to wave a real scope through.
 */
const ROUTE_SCOPE: Record<string, { scoped: boolean; why: string }> = {
  // ── project-scoped DB reads: the class this guard exists for ────────────────
  'feature-matrix': { scoped: true, why: 'getFeaturesByModule/getFeatureSummary run through projectScopeSql' },
  'feature-matrix/all-statuses': { scoped: true, why: 'getAllFeatureStatuses is project-scoped (was global until wave 15)' },
  'feature-matrix/aggregate': { scoped: true, why: 'getAllModuleAggregates is project-scoped' },
  'feature-matrix/scope': { scoped: true, why: 'reports the counts FOR a project scope — the scope it describes is the one passed' },
  'game-design-doc': { scoped: true, why: 'synthesizeGDD filters feature_matrix + review_snapshots by project (unscoped here is deliberately GLOBAL, and the document says so)' },
  'gdd-compliance': { scoped: true, why: 'runComplianceAudit reads getFeaturesByModule(mod.id, projectPath) per module, and gap resolutions are keyed by project_path' },
  'packaging/history': { scoped: true, why: 'build_history is scoped own-plus-legacy through build-history-store (wave 24)' },
  'harness/runs': { scoped: true, why: 'the run list filters on ?project=' },

  // ── project named for a NON-scope reason (cross-checked against the primitives) ──
  harness: { scoped: false, why: 'projectPath is the harness config target of `action: start`, not a row filter; GET reads the single live orchestrator' },
  'harness/runs/[id]': { scoped: false, why: 'a run is fetched by its own id; the run record carries its project' },
  'harness/runs/diff': { scoped: false, why: 'diffs two runs by id; each run carries its own project' },
  'pipeline-artifacts/drain': { scoped: false, why: 'projectPath is the .uproject an L4 visual gate renders its frame from (resolveUprojectPath), not a DB scope' },
  'filesystem/scan-project': { scoped: false, why: 'projectPath is the directory to scan on disk — required, so it cannot be dropped' },
  'filesystem/scan-assets': { scoped: false, why: 'projectPath is the directory to scan on disk — required' },
  'filesystem/verify-semantic': { scoped: false, why: 'projectPath is the directory to verify against on disk — required' },
  'ue5-source/parse': { scoped: false, why: 'projectPath is the Source/ tree to parse on disk — required' },
  'ue5-bridge/build': { scoped: false, why: 'projectPath identifies the build target/queue entry — required' },
  'ue5-bridge/build-health': { scoped: false, why: 'projectPath selects the build queue to report on — required' },
  'packaging/preflight': { scoped: false, why: 'projectPath is the project to preflight on disk — required' },

  // ── genuinely project-free routes ──────────────────────────────────────────
  'ability-spec': { scoped: false, why: 'catalog data keyed by catalogId/entityId; no project column' },
  'ai-testing': { scoped: false, why: 'AI test suites carry no project column' },
  'asset-code-oracle': { scoped: false, why: 'pure analysis of a posted class/asset set' },
  'balance-baseline': { scoped: false, why: 'catalog balance data keyed by catalogId/entityId' },
  'catalog/entities': { scoped: false, why: 'catalog registry — code-defined, not per-project rows' },
  'catalog/pipelines': { scoped: false, why: 'catalog registry — code-defined' },
  'catalog/step-recipe': { scoped: false, why: 'step recipe derived from the code-defined StepSpec' },
  'catalog/step-submit': { scoped: false, why: 'pipeline_artifacts is keyed (catalog_id, entity_id, step) — no project column' },
  'combat-simulator': { scoped: false, why: 'pure simulation over a posted scenario' },
  'crash-analyzer': { scoped: false, why: 'crash reports carry no project column' },
  'economy-simulator': { scoped: false, why: 'pure simulation over a posted config' },
  'economy-simulator/sweep': { scoped: false, why: 'pure parameter sweep over a posted config' },
  'pipeline-artifacts': { scoped: false, why: 'keyed (catalog_id, entity_id, step) — no project column' },
  'pipeline-artifacts/drain/evidence': { scoped: false, why: 'gate evidence hangs off the artifact row, not a project' },
  'pipeline-artifacts/drain/settle-test': { scoped: false, why: 'settles gates by test name against artifact rows' },
  'pof-bridge/compile': { scoped: false, why: 'talks to the one live editor bridge' },
  'pof-bridge/manifest': { scoped: false, why: 'talks to the one live editor bridge' },
  'pof-bridge/status': { scoped: false, why: 'talks to the one live editor bridge' },
  'pof-bridge/test': { scoped: false, why: 'talks to the one live editor bridge' },
  'preview/hydrate': { scoped: false, why: 'browser preview hydration from catalog artifacts' },
  'preview/mirror-map': { scoped: false, why: 'code-defined dual-execution mirror map' },
  'project-health': { scoped: false, why: 'fuses posted checklist/perf/crash inputs; reads no project-scoped table' },
  'project-rules': { scoped: false, why: 'the design canon is a single global rule set' },
  'regression-tracker': { scoped: false, why: 'regression fingerprints carry no project column' },
};

/**
 * (tool → why) a call to a `scoped: true` route deliberately states no project.
 *
 * Empty, and the stale-entry check below keeps it that way: an exemption is a claim that
 * an agent WANTS the legacy/unattributed view, which has been the wrong answer seven times
 * running. Add one only with a reason you would defend in review.
 */
const SCOPE_EXEMPT: Record<string, string> = {};

// ── probe machinery ──────────────────────────────────────────────────────────

interface Call { method: 'GET' | 'POST'; path: string; body?: unknown }

/** Fill a tool's arguments: its own example, then required params, then every project key. */
function probeArgs(t: ToolDef): Record<string, unknown> {
  const schema = t.inputSchema as { properties?: Record<string, any>; required?: string[] };
  const args: Record<string, unknown> = { ...(t.example?.args ?? {}) };
  const required = schema.required ?? [];
  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    if (key in args) continue;
    // Every project parameter is supplied whether required or not — the whole point is to
    // watch whether a project an agent DID state survives the trip to the route.
    if (PROJECT_KEY.test(key)) { args[key] = PROBE_PROJECT; continue; }
    if (!required.includes(key)) continue;
    switch (spec?.type) {
      case 'string': args[key] = spec.enum ? spec.enum[0] : 'probe'; break;
      case 'number': args[key] = 1; break;
      case 'object': args[key] = {}; break;
      case 'array': args[key] = []; break;
      case 'boolean': args[key] = false; break;
      default: args[key] = 'probe';
    }
  }
  return args;
}

/**
 * A reply shaped so no handler crashes reading it: an array (several handlers `.find` /
 * iterate the payload) that also carries the object keys they destructure.
 */
function probeReply(routePath: string, args: Record<string, unknown>): unknown {
  if (routePath.startsWith('/api/catalog/pipelines')) {
    return [{ catalogId: args.catalogId ?? 'items', steps: [] }];
  }
  return Object.assign([] as unknown[], {
    ok: true, hydratable: false, steps: [], statuses: [], modules: [],
    features: [], summary: {}, scope: {}, builds: [], entities: [],
  });
}

async function probe(t: ToolDef): Promise<{ calls: Call[]; error: string | null }> {
  const args = probeArgs(t);
  const calls: Call[] = [];
  const pof = {
    get: async (p: string) => { calls.push({ method: 'GET', path: p }); return probeReply(p, args); },
    post: async (p: string, body: unknown) => { calls.push({ method: 'POST', path: p, body }); return probeReply(p, args); },
  } as unknown as PofClient;
  try {
    await t.handler(args, pof);
    return { calls, error: null };
  } catch (e) {
    return { calls, error: e instanceof Error ? e.message : String(e) };
  }
}

/** `/api/harness/runs/r-42` → `harness/runs/[id]`, walking the real App Router tree. */
function resolveRoute(requestPath: string): string | null {
  const segments = requestPath.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  let dir = API_DIR;
  const parts: string[] = [];
  for (const seg of segments) {
    const exact = path.join(dir, seg);
    if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) { dir = exact; parts.push(seg); continue; }
    const dynamic = fs.readdirSync(dir)
      .find((d) => /^\[.*\]$/.test(d) && fs.statSync(path.join(dir, d)).isDirectory());
    if (!dynamic) return null;
    dir = path.join(dir, dynamic);
    parts.push(dynamic);
  }
  return fs.existsSync(path.join(dir, 'route.ts')) ? parts.join('/') : null;
}

function carriesProject(call: Call): boolean {
  if (call.method === 'GET') {
    const query = call.path.split('?')[1] ?? '';
    return [...new URLSearchParams(query).keys()].some((k) => PROJECT_KEY.test(k));
  }
  const body = call.body;
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some((k) => PROJECT_KEY.test(k));
}

function declaresProject(t: ToolDef): boolean {
  const props = (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  return Object.keys(props).some((k) => PROJECT_KEY.test(k));
}

/** One probe pass, shared by every assertion below. */
const PROBED = await Promise.all(
  TOOLS.map(async (t) => ({ tool: t, ...(await probe(t)) })),
);

// ── the guard ────────────────────────────────────────────────────────────────

test('the app route tree is where this guard thinks it is', () => {
  assert.ok(
    fs.existsSync(API_DIR),
    `cannot find the app routes at ${API_DIR} — this guard cross-checks pof-mcp against the REAL src/app/api tree and is worthless without it`,
  );
});

test('every registered tool reaches at least one route without throwing', () => {
  const blind = PROBED
    .filter((p) => p.error || p.calls.length === 0)
    .map((p) => `${p.tool.name}: ${p.error ?? 'made no route call at all'}`);
  assert.deepEqual(
    blind, [],
    'these handlers could not be probed, so the scope guard below is BLIND to them — give the probe a response shape it can read, or explain the tool:\n  ' + blind.join('\n  '),
  );
});

test('every route a tool calls resolves to a real app route.ts', () => {
  const unresolved: string[] = [];
  for (const { tool, calls } of PROBED) {
    for (const c of calls) {
      const p = c.path.split('?')[0];
      if (!resolveRoute(p)) unresolved.push(`${tool.name} → ${c.method} ${p}`);
    }
  }
  assert.deepEqual(unresolved, [], `pof-mcp calls routes that do not exist in src/app/api:\n  ${unresolved.join('\n  ')}`);
});

test('every route a tool calls is CLASSIFIED scoped/unscoped — a new route cannot default to silence', () => {
  const unclassified = new Set<string>();
  for (const { tool, calls } of PROBED) {
    for (const c of calls) {
      const route = resolveRoute(c.path.split('?')[0]);
      if (route && !(route in ROUTE_SCOPE)) unclassified.add(`${route} (called by ${tool.name})`);
    }
  }
  assert.deepEqual(
    [...unclassified], [],
    'these routes are reached by a pof-mcp tool but carry no scope verdict. Decide, in ROUTE_SCOPE, whether the route filters rows by project — do NOT guess:\n  ' + [...unclassified].join('\n  '),
  );
});

test('ROUTE_SCOPE carries no stale entries', () => {
  const called = new Set<string>();
  for (const { calls } of PROBED) {
    for (const c of calls) {
      const r = resolveRoute(c.path.split('?')[0]);
      if (r) called.add(r);
    }
  }
  const stale = Object.keys(ROUTE_SCOPE).filter((r) => !called.has(r));
  assert.deepEqual(stale, [], `ROUTE_SCOPE classifies routes no tool calls any more: ${stale.join(', ')}`);
});

test('a route declared UNSCOPED may not use the app\'s project-scoping primitives', () => {
  const liars: string[] = [];
  for (const [route, verdict] of Object.entries(ROUTE_SCOPE)) {
    if (verdict.scoped) continue;
    const file = path.join(API_DIR, route, 'route.ts');
    if (!fs.existsSync(file)) { liars.push(`${route}: no route.ts (stale classification)`); continue; }
    const src = fs.readFileSync(file, 'utf8');
    const hit = src.match(SCOPING_PRIMITIVES);
    if (hit) liars.push(`${route} is declared scoped:false ("${verdict.why}") but its route.ts uses ${hit[0]}`);
  }
  assert.deepEqual(
    liars, [],
    'a route that filters by project cannot be waved through as unscoped:\n  ' + liars.join('\n  '),
  );
});

test('every tool calling a PROJECT-SCOPED route forwards a project to it', () => {
  const dropped: string[] = [];
  for (const { tool, calls } of PROBED) {
    if (SCOPE_EXEMPT[tool.name]) continue;
    for (const c of calls) {
      const route = resolveRoute(c.path.split('?')[0]);
      if (!route || !ROUTE_SCOPE[route]?.scoped) continue;
      if (!carriesProject(c)) {
        dropped.push(
          `${tool.name} → ${c.method} ${c.path} — ${route} is project-scoped (${ROUTE_SCOPE[route].why}), `
          + 'so this read sees ONLY the unattributed legacy rows, which on a backfilled database is ZERO rows',
        );
      }
    }
  }
  assert.deepEqual(dropped, [], 'the project was dropped on the way to a project-scoped route:\n  ' + dropped.join('\n  '));
});

test('every tool calling a PROJECT-SCOPED route DECLARES a project parameter', () => {
  const mute: string[] = [];
  for (const { tool, calls } of PROBED) {
    if (declaresProject(tool)) continue;
    const scoped = calls
      .map((c) => resolveRoute(c.path.split('?')[0]))
      .filter((r): r is string => !!r && !!ROUTE_SCOPE[r]?.scoped);
    if (scoped.length) {
      mute.push(`${tool.name} hits ${[...new Set(scoped)].join(', ')} but its inputSchema declares no project — an agent cannot scope it even deliberately`);
    }
  }
  assert.deepEqual(mute, [], mute.join('\n  '));
});

test('SCOPE_EXEMPT carries no stale entries', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  const stale = Object.keys(SCOPE_EXEMPT).filter((n) => !names.has(n));
  assert.deepEqual(stale, [], `SCOPE_EXEMPT references unknown tools: ${stale.join(', ')}`);
});
