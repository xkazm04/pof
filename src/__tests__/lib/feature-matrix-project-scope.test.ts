/**
 * Project scoping on the feature matrix — phase 1.
 *
 * `project_id` was added to `feature_matrix` and `review_snapshots` by a migration
 * (`NOT NULL DEFAULT ''`) and then read and written by NOTHING. The schema LOOKED
 * scoped while every query was global, so opening project B scored B's checklist
 * against A's scan rows and plotted A's review history on B's sparkline.
 *
 * Every assertion below was RED before this change:
 *   • a row written under project A was returned to project B (and to every read,
 *     since no read had a WHERE at all);
 *   • the aggregate roll-up, the cross-module status table and the review history
 *     were all whole-table scans;
 *   • `captureReviewSnapshot` counted every project's rows into one trend point,
 *     and its prune could evict another project's history;
 *   • nothing could say how many rows carried the unattributed `''` id, or how many
 *     distinct projects the table held.
 *
 * Runs against the real SQLite schema (throwaway DB), not a mock.
 *
 * PHASE 2 (now shipped) RE-POINTED the takeover assertions rather than deleting
 * them. They pinned `takenOver` / `takenOverFromOtherProjects` / the 409-naming-the-
 * owner because takeover was POSSIBLE: the UNIQUE key was `(module_id, feature_name)`
 * so a feature was physically one row. The key is now
 * `(project_id, module_id, feature_name)`, so the same scenarios assert the new
 * truth — two projects hold the same feature simultaneously and NO takeover occurs —
 * and `takenOver` is asserted to be 0 for the write that used to return 1. The
 * 409 is kept and re-pointed: it no longer means "your row was taken", it means
 * "you have no row of your own and the one that exists is someone else's".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-project-scope-${process.pid}.db`;
});

import { GET, PATCH, POST } from '@/app/api/feature-matrix/route';
import { GET as SCOPE_GET } from '@/app/api/feature-matrix/scope/route';
import { GET as AGGREGATE_GET } from '@/app/api/feature-matrix/aggregate/route';
import { GET as STATUSES_GET } from '@/app/api/feature-matrix/all-statuses/route';
import {
  getFeaturesByModule,
  getFeatureSummary,
  getAllFeatureStatuses,
  getAllModuleAggregates,
  getReviewHistory,
  getAllReviewHistory,
  getProjectScopeReport,
  normalizeProjectId,
  clearModuleFeatures,
  upsertFeatures,
  updateFeatureStatus,
  captureReviewSnapshot,
} from '@/lib/feature-matrix-db';
import { runComplianceAudit } from '@/lib/gdd-compliance';
import { getDb } from '@/lib/db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const declared = MODULE_FEATURE_DEFINITIONS[MODULE]!;
const A_ONLY = declared[0].featureName;
const B_ONLY = declared[1].featureName;
const SHARED = declared[2].featureName;

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

function row(featureName: string, status: 'implemented' | 'partial' | 'missing', notes: string) {
  const def = declared.find((d) => d.featureName === featureName)!;
  return {
    featureName,
    category: def.category,
    status,
    description: def.description,
    filePaths: [],
    reviewNotes: notes,
    qualityScore: 4,
    nextSteps: '',
    lastReviewedAt: '2026-08-18T00:00:00.000Z',
  };
}

/** Insert a row the way EVERY pre-scoping write wrote one: no project_id at all. */
function insertLegacyRow(featureName: string, status = 'implemented') {
  getDb()
    .prepare(
      `INSERT INTO feature_matrix (module_id, feature_name, category, status, description, file_paths, review_notes, next_steps, last_reviewed_at)
       VALUES (?, ?, 'Core', ?, '', '[]', 'legacy', '', '2026-01-01T00:00:00.000Z')`,
    )
    .run(MODULE, featureName, status);
}

function req(url: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

async function json(res: Response) {
  return (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string };
}

function wipe() {
  const db = getDb();
  db.prepare('DELETE FROM feature_matrix WHERE module_id = ?').run(MODULE);
  db.prepare('DELETE FROM review_snapshots WHERE module_id = ?').run(MODULE);
}

beforeEach(() => {
  wipe();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('project identity is normalized, not compared raw', () => {
  it('treats the same path with different casing / separators as ONE project', () => {
    expect(normalizeProjectId('C:\\Games\\PoF')).toBe('c:/games/pof');
    expect(normalizeProjectId('c:/games/pof/')).toBe('c:/games/pof');
    expect(normalizeProjectId('C:/Games/PoF')).toBe(normalizeProjectId('C:\\Games\\PoF\\'));
  });

  it('normalizes an absent / blank project to the unscoped id, never to a fake one', () => {
    expect(normalizeProjectId(undefined)).toBe('');
    expect(normalizeProjectId(null)).toBe('');
    expect(normalizeProjectId('   ')).toBe('');
  });

  it('a write and a read spelling the path differently still see the same rows', () => {
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'a')], { projectId: PROJECT_A });
    const readBack = getFeaturesByModule(MODULE, PROJECT_A.replace(/\\/g, '/').toUpperCase());
    expect(readBack.map((f) => f.featureName)).toContain(A_ONLY);
  });
});

describe('a row written under project A is not returned when project B is active', () => {
  beforeEach(() => {
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A wrote this')], { projectId: PROJECT_A });
    upsertFeatures(MODULE, [row(B_ONLY, 'missing', 'B wrote this')], { projectId: PROJECT_B });
  });

  it('getFeaturesByModule shows each project only its own row', () => {
    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName)).toEqual([A_ONLY]);
    expect(getFeaturesByModule(MODULE, PROJECT_B).map((f) => f.featureName)).toEqual([B_ONLY]);
  });

  it('getFeatureSummary counts only the active project', () => {
    expect(getFeatureSummary(MODULE, PROJECT_A)).toMatchObject({ total: 1, implemented: 1, missing: 0 });
    expect(getFeatureSummary(MODULE, PROJECT_B)).toMatchObject({ total: 1, implemented: 0, missing: 1 });
  });

  it('the cross-module status table is scoped (it was a WHERE-less full scan)', () => {
    const names = (p: string) =>
      getAllFeatureStatuses(p).filter((s) => s.moduleId === MODULE).map((s) => s.featureName);
    expect(names(PROJECT_A)).toEqual([A_ONLY]);
    expect(names(PROJECT_B)).toEqual([B_ONLY]);
  });

  it('the per-module aggregate roll-up is scoped', () => {
    const totalFor = (p: string) =>
      getAllModuleAggregates(p).find((m) => m.moduleId === MODULE)?.total ?? 0;
    expect(totalFor(PROJECT_A)).toBe(1);
    expect(totalFor(PROJECT_B)).toBe(1);
  });

  it('the GET route scopes by the projectId it is given', async () => {
    const a = await json(await GET(req(`/api/feature-matrix?moduleId=${MODULE}&projectId=${encodeURIComponent(PROJECT_A)}`)));
    const b = await json(await GET(req(`/api/feature-matrix?moduleId=${MODULE}&projectId=${encodeURIComponent(PROJECT_B)}`)));
    expect((a.data!.features as { featureName: string }[]).map((f) => f.featureName)).toEqual([A_ONLY]);
    expect((b.data!.features as { featureName: string }[]).map((f) => f.featureName)).toEqual([B_ONLY]);
  });

  it('the aggregate and all-statuses routes scope the same way', async () => {
    const agg = await json(await AGGREGATE_GET(req(`/api/feature-matrix/aggregate?projectId=${encodeURIComponent(PROJECT_A)}`)));
    const mod = (agg.data!.modules as { moduleId: string; total: number }[]).find((m) => m.moduleId === MODULE);
    expect(mod?.total).toBe(1);

    const st = await json(await STATUSES_GET(req(`/api/feature-matrix/all-statuses?projectId=${encodeURIComponent(PROJECT_B)}`)));
    const rows = (st.data!.statuses as { moduleId: string; featureName: string }[])
      .filter((s) => s.moduleId === MODULE);
    expect(rows.map((s) => s.featureName)).toEqual([B_ONLY]);
  });

  it('runComplianceAudit scores the project it was asked about, not the whole table', () => {
    const forA = runComplianceAudit({}, PROJECT_A).modules.find((m) => m.moduleId === MODULE);
    const forB = runComplianceAudit({}, PROJECT_B).modules.find((m) => m.moduleId === MODULE);
    expect(forA?.totalFeatures).toBe(1);
    expect(forA?.implemented).toBe(1);
    expect(forB?.totalFeatures).toBe(1);
    expect(forB?.missing).toBe(1);
  });
});

describe('legacy rows (project_id = "") never silently vanish', () => {
  beforeEach(() => {
    insertLegacyRow(SHARED);
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
  });

  it('STATED FALLBACK: an unattributed row is visible to every named project', () => {
    // Nothing proves who wrote it, and a user's whole matrix disappearing is worse
    // than the contamination this narrows — so it is shown, and counted.
    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName).sort())
      .toEqual([A_ONLY, SHARED].sort());
    expect(getFeaturesByModule(MODULE, PROJECT_B).map((f) => f.featureName)).toEqual([SHARED]);
  });

  it('the legacy row is COUNTED as legacy, not passed off as the project\'s own', () => {
    const scope = getProjectScopeReport(PROJECT_A, MODULE);
    expect(scope.ownedRows).toBe(1);
    expect(scope.legacyRows).toBe(1);
    expect(scope.foreignRows).toBe(0);

    const forB = getProjectScopeReport(PROJECT_B, MODULE);
    expect(forB.ownedRows).toBe(0);
    expect(forB.legacyRows).toBe(1);
    expect(forB.foreignRows).toBe(1); // A's row — excluded, and said so
  });

  it('a scoped READ still never adopts or backfills the legacy row (only a write can)', () => {
    getFeaturesByModule(MODULE, PROJECT_A);
    getProjectScopeReport(PROJECT_A, MODULE);
    const stored = getDb()
      .prepare('SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
      .get(MODULE, SHARED) as { project_id: string };
    expect(stored.project_id).toBe('');
  });
});

describe('an unscoped read says it is unscoped instead of silently returning everything', () => {
  beforeEach(() => {
    insertLegacyRow(SHARED);
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
  });

  it('returns the LEGACY set — not every project\'s rows', () => {
    expect(getFeaturesByModule(MODULE).map((f) => f.featureName)).toEqual([SHARED]);
  });

  it('reports the ambiguity, naming what it excluded', () => {
    const scope = getProjectScopeReport(undefined, MODULE);
    expect(scope.unscoped).toBe(true);
    expect(scope.legacyRows).toBe(1);
    expect(scope.foreignRows).toBe(1);
    expect(scope.note).toMatch(/UNSCOPED/);
    expect(scope.note).toMatch(/excluded 1 row/);
  });

  it('the GET route carries that statement to the client', async () => {
    const res = await json(await GET(req(`/api/feature-matrix?moduleId=${MODULE}`)));
    const scope = res.data!.scope as { unscoped: boolean; foreignRows: number };
    expect(scope.unscoped).toBe(true);
    expect(scope.foreignRows).toBe(1);
  });
});

describe('the contamination report counts rows correctly', () => {
  it('counts unattributed rows and distinct projects across the whole table', () => {
    insertLegacyRow(SHARED);
    insertLegacyRow(declared[3].featureName);
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
    upsertFeatures(MODULE, [row(B_ONLY, 'partial', 'B')], { projectId: PROJECT_B });

    const scope = getProjectScopeReport(PROJECT_A, MODULE);
    expect(scope.totalRows).toBe(4);
    expect(scope.legacyRows).toBe(2);
    expect(scope.ownedRows).toBe(1);
    expect(scope.foreignRows).toBe(1);
    expect(scope.distinctProjects).toBe(2);
    expect(scope.projects.find((p) => p.projectId === '')?.rows).toBe(2);
    expect(scope.projects.find((p) => p.projectId === normalizeProjectId(PROJECT_B))?.rows).toBe(1);
  });

  it('the /scope route answers with the same counts', async () => {
    insertLegacyRow(SHARED);
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });

    const res = await json(await SCOPE_GET(
      req(`/api/feature-matrix/scope?projectId=${encodeURIComponent(PROJECT_A)}&moduleId=${MODULE}`),
    ));
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      projectId: normalizeProjectId(PROJECT_A),
      unscoped: false,
      legacyRows: 1,
      ownedRows: 1,
      distinctProjects: 1,
    });
  });

  it('reporting never moves a row (it is a read, and says so by leaving the table alone)', () => {
    insertLegacyRow(SHARED);
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
    const before = getDb()
      .prepare('SELECT feature_name, project_id, status FROM feature_matrix WHERE module_id = ? ORDER BY feature_name')
      .all(MODULE);
    getProjectScopeReport(PROJECT_B, MODULE);
    getProjectScopeReport('', MODULE);
    const after = getDb()
      .prepare('SELECT feature_name, project_id, status FROM feature_matrix WHERE module_id = ? ORDER BY feature_name')
      .all(MODULE);
    expect(after).toEqual(before);
  });
});

describe('every write path stamps the active project', () => {
  it('a seed stamps the project that seeded it', async () => {
    await POST(req('/api/feature-matrix', 'POST', {
      moduleId: MODULE,
      seedOnly: true,
      source: 'seed',
      projectId: PROJECT_B,
      features: [{ ...row(B_ONLY, 'missing', ''), status: 'unknown' }],
    }));
    const stored = getDb()
      .prepare('SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
      .get(MODULE, B_ONLY) as { project_id: string };
    expect(stored.project_id).toBe(normalizeProjectId(PROJECT_B));
  });

  it('the fix PATCH stamps the project and reports it', async () => {
    upsertFeatures(MODULE, [row(A_ONLY, 'partial', 'A')], { projectId: PROJECT_A });
    const res = await json(await PATCH(req('/api/feature-matrix', 'PATCH', {
      moduleId: MODULE, featureName: A_ONLY, status: 'implemented', projectId: PROJECT_A,
    })));
    expect(res.success).toBe(true);
    expect(res.data!.projectId).toBe(normalizeProjectId(PROJECT_A));
    expect(getFeaturesByModule(MODULE, PROJECT_A)[0].status).toBe('implemented');
  });

  it('a PATCH where the caller holds NO row is refused and names who does', async () => {
    // RE-POINTED (phase 2): this used to assert a takeover was refused. Under the
    // widened key B simply has no row of its own — but reporting "no such feature"
    // for a feature that plainly exists in the module is the mis-attribution the
    // scoping removes, so the 409 still names the project that does hold one.
    upsertFeatures(MODULE, [row(A_ONLY, 'partial', 'A')], { projectId: PROJECT_A });
    const res = await PATCH(req('/api/feature-matrix', 'PATCH', {
      moduleId: MODULE, featureName: A_ONLY, status: 'implemented', projectId: PROJECT_B,
    }));
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error).toContain(normalizeProjectId(PROJECT_A));
    // ...and the row is untouched, not half-written.
    expect(getFeaturesByModule(MODULE, PROJECT_A)[0].status).toBe('partial');
  });

  it('a status update on an unattributed row claims it for the writer, and reports no foreign owner', () => {
    insertLegacyRow(SHARED, 'partial');
    const result = updateFeatureStatus(MODULE, SHARED, 'implemented', { projectId: PROJECT_B });
    expect(result.updated).toBe(true);
    expect(result.foreignOwner).toBeNull();
    const stored = getDb()
      .prepare('SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
      .get(MODULE, SHARED) as { project_id: string };
    expect(stored.project_id).toBe(normalizeProjectId(PROJECT_B));
  });

  it('RE-POINTED: a write under B takes NOTHING from A — both hold the feature', () => {
    // This assertion pinned `takenOver === 1` while takeover was possible. The
    // project is now part of the UNIQUE key, so the same scenario asserts the new
    // truth: B gets its own row, A keeps its own, and neither status is the other's.
    upsertFeatures(MODULE, [row(SHARED, 'implemented', 'A')], { projectId: PROJECT_A });
    const result = upsertFeatures(MODULE, [row(SHARED, 'missing', 'B')], { projectId: PROJECT_B });
    expect(result.takenOver).toBe(0);
    expect(result.projectId).toBe(normalizeProjectId(PROJECT_B));

    const forA = getFeaturesByModule(MODULE, PROJECT_A);
    const forB = getFeaturesByModule(MODULE, PROJECT_B);
    expect(forA.map((f) => f.featureName)).toEqual([SHARED]);
    expect(forB.map((f) => f.featureName)).toEqual([SHARED]);
    expect(forA[0].status).toBe('implemented');
    expect(forB[0].status).toBe('missing');
    // Two physical rows now, and A's is not foreign to A.
    expect(getProjectScopeReport(PROJECT_A, MODULE).ownedRows).toBe(1);
    expect(getProjectScopeReport(PROJECT_A, MODULE).foreignRows).toBe(1);
  });

  it('RE-POINTED: a seedOnly write under B also gets its own row, taking nothing', () => {
    upsertFeatures(MODULE, [row(SHARED, 'implemented', 'A')], { projectId: PROJECT_A });
    const result = upsertFeatures(MODULE, [row(SHARED, 'unknown' as 'missing', '')], {
      projectId: PROJECT_B, seedOnly: true,
    });
    expect(result.takenOver).toBe(0);
    // A is untouched (the original assertion) AND B now has a seed row of its own
    // (the new truth) — a seed under one project used to be a DO NOTHING against
    // another project's reviewed row.
    expect(getFeaturesByModule(MODULE, PROJECT_A)).toHaveLength(1);
    expect(getFeaturesByModule(MODULE, PROJECT_A)[0].status).toBe('implemented');
    expect(getFeaturesByModule(MODULE, PROJECT_B).map((f) => f.status)).toEqual(['unknown']);
  });

  it('RE-POINTED: the POST route reports zero takeovers where it used to report one', async () => {
    upsertFeatures(MODULE, [row(SHARED, 'implemented', 'A')], { projectId: PROJECT_A });
    const res = await json(await POST(req('/api/feature-matrix', 'POST', {
      moduleId: MODULE, projectId: PROJECT_B, source: 'review',
      features: [row(SHARED, 'missing', 'B')],
    })));
    expect(res.data!.takenOverFromOtherProjects).toBe(0);
    expect(getFeaturesByModule(MODULE, PROJECT_A)[0].status).toBe('implemented');
  });

  it('a write CLAIMS an unattributed row instead of listing the feature twice', () => {
    // A named project reads `own OR ''`. Inserting beside a legacy row would show
    // the same feature twice; the legacy row is adopted, and the adoption reported.
    insertLegacyRow(SHARED, 'partial');
    const result = upsertFeatures(MODULE, [row(SHARED, 'implemented', 'A')], { projectId: PROJECT_A });
    expect(result.adoptedLegacy).toBe(1);
    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName)).toEqual([SHARED]);
    const stored = getDb()
      .prepare('SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
      .all(MODULE, SHARED) as { project_id: string }[];
    expect(stored).toEqual([{ project_id: normalizeProjectId(PROJECT_A) }]);
  });

  it('clearModuleFeatures cannot reach another project\'s rows', () => {
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
    upsertFeatures(MODULE, [row(B_ONLY, 'missing', 'B')], { projectId: PROJECT_B });
    clearModuleFeatures(MODULE, PROJECT_B);
    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName)).toEqual([A_ONLY]);
    expect(getFeaturesByModule(MODULE, PROJECT_B)).toHaveLength(0);
  });
});

describe('review snapshots are per project', () => {
  it('a capture counts only the capturing project\'s rows', () => {
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
    upsertFeatures(MODULE, [row(B_ONLY, 'missing', 'B')], { projectId: PROJECT_B });
    captureReviewSnapshot(MODULE, PROJECT_A);
    captureReviewSnapshot(MODULE, PROJECT_B);

    const a = getReviewHistory(MODULE, 20, PROJECT_A);
    const b = getReviewHistory(MODULE, 20, PROJECT_B);
    expect(a.at(-1)!.total).toBe(1);
    expect(a.at(-1)!.implemented).toBe(1);
    expect(b.at(-1)!.total).toBe(1);
    expect(b.at(-1)!.missing).toBe(1);
  });

  it('one project\'s trend line is not another\'s', () => {
    upsertFeatures(MODULE, [row(A_ONLY, 'implemented', 'A')], { projectId: PROJECT_A });
    captureReviewSnapshot(MODULE, PROJECT_A);
    // B has never been reviewed: its history must be empty, not A's.
    expect(getReviewHistory(MODULE, 20, PROJECT_B)).toHaveLength(0);
    expect(getAllReviewHistory(20, PROJECT_B)[MODULE]).toBeUndefined();
    expect(getAllReviewHistory(20, PROJECT_A)[MODULE]).toHaveLength(1);
  });

  it('a legacy snapshot stays visible to every project and is not adopted', () => {
    getDb()
      .prepare(
        `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, improved, partial, missing, unknown, avg_quality)
         VALUES (?, '2026-01-01T00:00:00.000Z', 3, 3, 0, 0, 0, 0, 4.0)`,
      )
      .run(MODULE);
    expect(getReviewHistory(MODULE, 20, PROJECT_A)).toHaveLength(1);
    expect(getReviewHistory(MODULE, 20, PROJECT_B)).toHaveLength(1);
    const stored = getDb()
      .prepare('SELECT project_id FROM review_snapshots WHERE module_id = ?')
      .all(MODULE) as { project_id: string }[];
    expect(stored.every((s) => s.project_id === '')).toBe(true);
  });
});
