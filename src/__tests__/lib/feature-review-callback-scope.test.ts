/**
 * CLI review / fix callbacks write under the RUN's project, and an owned row
 * shadows its legacy twin on read.
 *
 * The feature-review callback (POST /api/feature-matrix/import) and the
 * feature-fix callback (PATCH /api/feature-matrix) declared `staticFields`
 * without the project, so every CLI review wrote unattributed (`''`) rows and
 * every CLI fix PATCHed unscoped. Under a named project that listed a reviewed
 * feature twice (own + legacy twin), turned every Fix into a 409 naming the
 * active project itself as the "foreign owner", and made the next scoped write
 * of that feature crash on the `(project_id, module_id, feature_name)` UNIQUE
 * key when `upsertFeatures` tried to adopt the twin.
 *
 * Asserted through the reader (GET /api/feature-matrix), driving the real route
 * handlers with the body the server's settlement would POST
 * (`mergeCallbackBody(descriptor.staticFields, payload)`). Throwaway DB in a
 * per-file mkdtemp dir — never ~/.pof/pof.db.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-test-fm-callback-scope-'));
  process.env.POF_DB_PATH = path.join(dir, 'pof.db');
});

import { GET, PATCH } from '@/app/api/feature-matrix/route';
import { POST as IMPORT_POST } from '@/app/api/feature-matrix/import/route';
import {
  TaskFactory,
  buildTaskPrompt,
  getCallback,
  mergeCallbackBody,
  type TaskCallback,
} from '@/lib/cli-task';
import {
  upsertFeatures,
  getFeaturesByModule,
  getFeatureSummary,
  getAllFeatureStatuses,
  getAllModuleAggregates,
  getProjectScopeReport,
  normalizeProjectId,
  type UpsertFeature,
} from '@/lib/feature-matrix-db';
import { getDb } from '@/lib/db';
import type { ProjectContext } from '@/lib/prompt-context';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const ORIGIN = 'http://localhost:3000';
const P_RAW = 'C:\\P\\PoF';
const P = normalizeProjectId(P_RAW);
const CTX: ProjectContext = { projectName: 'PoF', projectPath: P_RAW, ueVersion: '5.8.0' };

// Real arpg-combat definition names — the import route rejects unknown names.
const DODGE = 'Dodge ability (GAS)';
const PARRY = 'Combo system';

const DEFS: FeatureDefinition[] = [
  { featureName: DODGE, category: 'Abilities', description: 'GA_Dodge' },
];

const row = (featureName: string, status: FeatureStatus): UpsertFeature => ({
  featureName,
  category: 'Abilities',
  status,
  description: `${featureName} — ${status}`,
  filePaths: [],
  reviewNotes: '',
});

/** The descriptor a built prompt registered (its one @@CALLBACK marker). */
function callbackOf(prompt: string): TaskCallback {
  const id = /@@CALLBACK:(\S+)/.exec(prompt)?.[1];
  expect(id).toBeTruthy();
  const cb = getCallback(id!);
  expect(cb).toBeDefined();
  return cb!;
}

const reviewCallback = () =>
  callbackOf(buildTaskPrompt(TaskFactory.featureReview(MODULE, 'Combat', DEFS, ORIGIN, 'x'), CTX));

const fixCallback = () =>
  callbackOf(
    buildTaskPrompt(
      TaskFactory.featureFix(
        MODULE,
        { featureName: PARRY, status: 'partial', nextSteps: 'n', filePaths: [], qualityScore: null },
        'x',
        ORIGIN,
      ),
      CTX,
    ),
  );

function merged(cb: TaskCallback, payload: Record<string, unknown>): Record<string, unknown> {
  const m = mergeCallbackBody(cb.staticFields, JSON.stringify(payload));
  if (!m.ok) throw new Error(m.error);
  return m.body;
}

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });

async function readUnder(projectId: string) {
  const res = await GET(
    req(`http://localhost/api/feature-matrix?moduleId=${MODULE}&projectId=${encodeURIComponent(projectId)}`, 'GET'),
  );
  const json = (await res.json()) as {
    data: { features: { featureName: string; status: string }[]; summary: { total: number } };
  };
  return json.data;
}

/** A polluted DB: P's own row AND a legacy ('') twin for the same feature. */
function seedTwin(featureName: string, own: FeatureStatus, legacy: FeatureStatus) {
  upsertFeatures(MODULE, [row(featureName, own)], { source: 'review', projectId: P });
  upsertFeatures(MODULE, [row(featureName, legacy)], { source: 'review', projectId: '' });
}

beforeEach(() => {
  getDb().prepare('DELETE FROM feature_matrix').run();
  getDb().prepare('DELETE FROM review_snapshots').run();
});

describe('callback descriptors carry the run project', () => {
  it('feature-review → /api/feature-matrix/import stamps projectId', () => {
    const cb = reviewCallback();
    expect(cb.url).toBe(`${ORIGIN}/api/feature-matrix/import`);
    expect(cb.staticFields.projectId).toBe('c:/p/pof');
    expect(cb.staticFields.moduleId).toBe(MODULE);
  });

  it('feature-fix → PATCH /api/feature-matrix stamps projectId', () => {
    const cb = fixCallback();
    expect(cb.url).toBe(`${ORIGIN}/api/feature-matrix`);
    expect(cb.method).toBe('PATCH');
    expect(cb.staticFields.projectId).toBe(normalizeProjectId(P_RAW));
  });
});

describe('reader: the callback body lands on the project own row', () => {
  it('a review settles onto P own row — one row, implemented, total 1', async () => {
    upsertFeatures(MODULE, [row(DODGE, 'partial')], { source: 'review', projectId: P });
    const body = merged(reviewCallback(), {
      reviewedAt: '2026-10-01T00:00:00.000Z',
      features: [{ featureName: DODGE, category: 'Abilities', status: 'implemented' }],
    });
    const res = await IMPORT_POST(req('http://localhost/api/feature-matrix/import', 'POST', body));
    expect(res.status).toBe(200);

    const data = await readUnder(P);
    const dodge = data.features.filter((f) => f.featureName === DODGE);
    expect(dodge.map((f) => f.status)).toEqual(['implemented']);
    expect(data.summary.total).toBe(1);
  });

  it('a fix PATCH updates P own row instead of 409-ing on itself', async () => {
    upsertFeatures(MODULE, [row(PARRY, 'partial')], { source: 'review', projectId: P });
    const body = merged(fixCallback(), { completed: true });
    expect(body).toMatchObject({ moduleId: MODULE, featureName: PARRY, status: 'improved', completed: true });

    const res = await PATCH(req('http://localhost/api/feature-matrix', 'PATCH', body));
    const json = (await res.json()) as { data?: { updated: boolean } };
    expect(res.status).toBe(200);
    expect(json.data?.updated).toBe(true);

    const data = await readUnder(P);
    expect(data.features.find((f) => f.featureName === PARRY)?.status).toBe('improved');
  });
});

describe('polluted DB: own row + legacy twin', () => {
  it('a scoped write over a twin does not throw UNIQUE and leaves the twin in place', () => {
    seedTwin(DODGE, 'partial', 'implemented');
    let result: ReturnType<typeof upsertFeatures> | undefined;
    expect(() => {
      result = upsertFeatures(MODULE, [row(DODGE, 'missing')], { source: 'review', projectId: P });
    }).not.toThrow();
    expect(result?.adoptedLegacy).toBe(0);

    const rows = getDb()
      .prepare('SELECT project_id, status FROM feature_matrix WHERE module_id = ? AND feature_name = ? ORDER BY project_id')
      .all(MODULE, DODGE) as { project_id: string; status: string }[];
    expect(rows).toEqual([
      { project_id: '', status: 'implemented' },
      { project_id: P, status: 'missing' },
    ]);
  });

  it('scoped reads count the feature once (own row wins); the scope report still discloses the twin', () => {
    seedTwin(DODGE, 'partial', 'implemented');

    const list = getFeaturesByModule(MODULE, P).filter((f) => f.featureName === DODGE);
    expect(list.map((f) => f.status)).toEqual(['partial']);

    expect(getFeatureSummary(MODULE, P).total).toBe(1);

    const statuses = getAllFeatureStatuses(P).filter((s) => s.featureName === DODGE);
    expect(statuses.map((s) => s.status)).toEqual(['partial']);

    const agg = getAllModuleAggregates(P).find((a) => a.moduleId === MODULE);
    expect(agg?.total).toBe(1);
    expect(agg?.partial).toBe(1);
    expect(agg?.implemented).toBe(0);

    const report = getProjectScopeReport(P, MODULE);
    expect(report.legacyRows).toBe(1);
    expect(report.ownedRows).toBe(1);
  });

  it('[guard] an unscoped read still returns only the legacy twin', () => {
    seedTwin(DODGE, 'partial', 'implemented');
    const list = getFeaturesByModule(MODULE, '').filter((f) => f.featureName === DODGE);
    expect(list.map((f) => f.status)).toEqual(['implemented']);
  });
});
