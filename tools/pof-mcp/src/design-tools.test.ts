import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_TOOLS } from './tools/design.js';
import type { ToolDef } from './tools/shared.js';
import type { PofClient } from './pofClient.js';

/**
 * ── The feature matrix is PROJECT-SCOPED, and these tools never said so ──────
 *
 * Wave 16 (`42a71127`) attributed every `feature_matrix` row to the project that produced
 * it — correctly, on the operator's explicit decision, 165/165 rows preserved. But
 * `projectScopeSql('')` resolves to `project_id = ''`, i.e. LEGACY ROWS ONLY, and after the
 * backfill there are no legacy rows left. Measured on the live DB 2026-08-20:
 * `feature_matrix` = 165 rows, 0 with `project_id = ''`; `review_snapshots` = 10 rows, 0 legacy.
 *
 * So `pof_feature_matrix`, `_all` and `_aggregate` returned 0 of 165, `pof_gdd_compliance`
 * scored every module against zero evidence and wrote its gap resolutions under `''`, and
 * `pof_gdd` synthesized a cross-project document without saying so — and NONE of their
 * schemas declared a project, so an agent could not scope them even deliberately.
 *
 * The backend below is shaped like the LIVE database: rows exist, and they are visible
 * only to a caller that names the project. Every assertion here is about the tool layer.
 */

const PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

function tool(name: string): ToolDef {
  const t = DESIGN_TOOLS.find((x) => x.name === name);
  assert.ok(t, `tool ${name} not registered`);
  return t!;
}

interface Call { method: 'get' | 'post'; path: string; body?: unknown }

/** Did this request state a project, in any of the spellings the app accepts? */
function stated(call: Call): boolean {
  if (call.method === 'get') {
    const q = new URLSearchParams(call.path.split('?')[1] ?? '');
    return !!(q.get('projectId') ?? q.get('projectPath'));
  }
  const b = (call.body ?? {}) as Record<string, unknown>;
  return typeof (b.projectId ?? b.projectPath) === 'string';
}

/** The live-shaped scope report the routes return beside their rows. */
const SCOPE_COUNTS = {
  projectId: '', unscoped: true, totalRows: 165, legacyRows: 0, ownedRows: 0, foreignRows: 165,
  projects: [{ projectId: 'c:/users/kazda/documents/unreal projects/pof', rows: 165 }], distinctProjects: 1,
};

/**
 * A backend that behaves like the real one after wave 16: it answers with rows ONLY when
 * the caller stated the project, and always reports the scope counts that explain an
 * empty answer. `''` sees nothing because nothing is unattributed any more.
 */
function liveShaped() {
  const calls: Call[] = [];
  const rows = (call: Call) => (stated(call) ? 165 : 0);
  const pof = {
    get: async (path: string) => {
      const call: Call = { method: 'get', path };
      calls.push(call);
      const n = rows(call);
      if (path.startsWith('/api/feature-matrix/all-statuses')) {
        return { statuses: n ? [{ moduleId: 'arpg-combat', implemented: 12 }] : [], scope: SCOPE_COUNTS };
      }
      if (path.startsWith('/api/feature-matrix/aggregate')) {
        return { modules: n ? [{ moduleId: 'arpg-combat', total: 12 }] : [], scope: SCOPE_COUNTS };
      }
      if (path.startsWith('/api/feature-matrix/scope')) return SCOPE_COUNTS;
      if (path.startsWith('/api/feature-matrix')) {
        return {
          features: n ? [{ featureName: 'Hit reactions', status: 'implemented' }] : [],
          summary: { total: n ? 1 : 0 },
          scope: SCOPE_COUNTS,
        };
      }
      if (path.startsWith('/api/game-design-doc')) {
        return { title: 'PoF', sections: [], scope: { projectId: stated(call) ? PROJECT.toLowerCase() : '', scoped: stated(call) } };
      }
      return { ok: true };
    },
    post: async (path: string, body: unknown) => {
      const call: Call = { method: 'post', path, body };
      calls.push(call);
      // The audit's evidence is the scoped feature rows; unscoped it has none.
      return { overallScore: stated(call) ? 74 : 0, modules: [], gaps: [] };
    },
  } as unknown as PofClient;
  return { pof, calls };
}

const SCOPED_TOOLS = ['pof_feature_matrix', 'pof_feature_matrix_all', 'pof_feature_matrix_aggregate', 'pof_gdd_compliance', 'pof_gdd'];

// ── the schema an agent reads ────────────────────────────────────────────────

test('every project-scoped design tool DECLARES a project parameter', () => {
  const mute = SCOPED_TOOLS.filter((n) => {
    const props = (tool(n).inputSchema as { properties: Record<string, unknown> }).properties;
    return !('projectPath' in props);
  });
  assert.deepEqual(
    mute, [],
    `these tools cannot be scoped at all — their schema declares no project, so an agent literally cannot ask for its own rows: ${mute.join(', ')}`,
  );
});

// ── the read an AGENT makes must reach the rows ──────────────────────────────

test('pof_feature_matrix returns the project\'s rows when scoped, and NOTHING when not', async () => {
  const scopedRun = liveShaped();
  const scoped = await tool('pof_feature_matrix').handler({ moduleId: 'arpg-combat', projectPath: PROJECT }, scopedRun.pof) as {
    result: { features: unknown[] }; scope: { scoped: boolean; note: string; counts: unknown };
  };
  assert.equal(scoped.result.features.length, 1, `the project was dropped on the way to the route: ${scopedRun.calls[0].path}`);
  assert.equal(scoped.scope.scoped, true);

  const bareRun = liveShaped();
  const bare = await tool('pof_feature_matrix').handler({ moduleId: 'arpg-combat' }, bareRun.pof) as {
    result: { features: unknown[] }; scope: { scoped: boolean; note: string; counts: { totalRows: number } };
  };
  // Zero rows is the TRUE answer for the legacy view — the lie was returning it silently.
  assert.equal(bare.result.features.length, 0);
  assert.match(bare.scope.note, /UNSCOPED/, 'an unscoped read must SAY it is unscoped');
  assert.match(bare.scope.note, /legacy/i);
  assert.equal(bare.scope.counts.totalRows, 165, 'the backend\'s own scope counts must ride along, so 0 rows reads as "another project owns these"');
});

test('pof_feature_matrix_all forwards the project and states its scope', async () => {
  const { pof, calls } = liveShaped();
  const out = await tool('pof_feature_matrix_all').handler({ projectPath: PROJECT }, pof) as {
    result: { statuses: unknown[] }; scope: { scoped: boolean; projectPath: string | null };
  };
  assert.match(
    calls[0].path,
    /projectPath=C%3A%2FUsers%2Fkazda%2FDocuments%2FUnreal\+Projects%2FPoF/,
    `the project was dropped on the way to the route: ${calls[0].path}`,
  );
  assert.equal(out.result.statuses.length, 1);
  assert.equal(out.scope.projectPath, PROJECT);
});

test('pof_feature_matrix_aggregate forwards the project and states its scope', async () => {
  const { pof, calls } = liveShaped();
  const out = await tool('pof_feature_matrix_aggregate').handler({ projectPath: PROJECT }, pof) as {
    result: { modules: unknown[] }; scope: { scoped: boolean };
  };
  assert.match(calls[0].path, /projectPath=/, `the project was dropped on the way to the route: ${calls[0].path}`);
  assert.equal(out.result.modules.length, 1);
  assert.equal(out.scope.scoped, true);
});

// ── the audit that scored every module against zero evidence ─────────────────

test('pof_gdd_compliance audits UNDER the project it was given', async () => {
  const { pof, calls } = liveShaped();
  const out = await tool('pof_gdd_compliance').handler({ projectPath: PROJECT }, pof) as {
    result: { overallScore: number }; scope: { scoped: boolean; counts: { totalRows: number } };
  };
  const audit = calls.find((c) => c.method === 'post')!;
  assert.equal((audit.body as { action: string }).action, 'audit');
  assert.equal(
    (audit.body as { projectPath?: string }).projectPath, PROJECT,
    'the audit reads getFeaturesByModule(mod.id, projectPath) per module — without the project it scores every module against zero evidence',
  );
  assert.equal(out.result.overallScore, 74);
  assert.equal(out.scope.counts.totalRows, 165, 'the audit must disclose the evidence base it scored against');
});

test('pof_gdd_compliance WRITES its gap resolutions under the same scope it audited', async () => {
  const { pof, calls } = liveShaped();
  await tool('pof_gdd_compliance').handler(
    { action: 'resolve-gap', gapId: 'arpg-combat::dodge', note: 'shipped in 5.8', projectPath: PROJECT },
    pof,
  );
  const write = calls.find((c) => c.method === 'post')!;
  const body = write.body as Record<string, unknown>;
  assert.equal(body.action, 'resolve-gap');
  assert.equal(body.gapId, 'arpg-combat::dodge');
  assert.equal(
    body.projectPath, PROJECT,
    'gap resolutions are keyed by project_path — an unscoped remediation lands where no scoped reader will ever see it',
  );
});

test('pof_gdd_compliance reports a failed scope lookup instead of swallowing it', async () => {
  const pof = {
    get: async (path: string) => { throw new Error(`backend exploded on ${path}`); },
    post: async () => ({ overallScore: 74 }),
  } as unknown as PofClient;
  const out = await tool('pof_gdd_compliance').handler({ projectPath: PROJECT }, pof) as {
    scope: { scoped: boolean; counts: { error?: string } };
  };
  assert.equal(out.scope.scoped, true);
  assert.match(out.scope.counts.error ?? '', /backend exploded/);
});

// ── the synthesis whose unscoped read is GLOBAL, not legacy ──────────────────

test('pof_gdd forwards the project, and says GLOBAL (not legacy) when given none', async () => {
  const scopedRun = liveShaped();
  await tool('pof_gdd').handler({ projectPath: PROJECT }, scopedRun.pof);
  assert.match(scopedRun.calls[0].path, /projectPath=/, `the project was dropped on the way to the route: ${scopedRun.calls[0].path}`);

  const bareRun = liveShaped();
  const bare = await tool('pof_gdd').handler({}, bareRun.pof) as { scope: { scoped: boolean; note: string } };
  assert.equal(bare.scope.scoped, false);
  assert.match(bare.scope.note, /GLOBAL/, 'this route\'s unscoped read spans every project — calling it "legacy" would be a different lie');
  assert.match(bare.scope.note, /EVERY project/i);
});
