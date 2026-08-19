/**
 * `/api/game-design-doc` forwards the caller's project to `synthesizeGDD`.
 *
 * Wave 16 widened the `feature_matrix` UNIQUE key to
 * `(project_id, module_id, feature_name)`, so two projects can legitimately hold the
 * SAME `(module, feature)`. `synthesizeGDD` was taught an optional `projectId` and
 * scopes its three reads (2 × `feature_matrix`, 1 × `review_snapshots`) when given
 * one — but the route forwarded nothing, so every document was the global view and
 * a two-project feature was counted ONCE PER PROJECT while reading as one project's
 * progress.
 *
 * Every assertion below was RED before this change:
 *   • POST `generate` with `projectPath` counted the shared feature twice;
 *   • GET `?projectId=` did the same;
 *   • the review trend mixed the other project's newer snapshot into this one;
 *   • no document said which rows it was built from, scoped or global.
 *
 * Runs the real route handlers against the real SQLite schema (throwaway DB).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gdd-project-scope-${process.pid}.db`;
});

import { GET, POST } from '@/app/api/game-design-doc/route';
import { getDb } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

const MODULE = 'arpg-combat';
const SHARED = 'Shared Feature Both Projects Hold';
const A_ONLY = 'Feature Only A Holds';
const LEGACY = 'Unattributed Legacy Feature';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

function insertFeature(featureName: string, projectPath: string, status = 'implemented') {
  getDb()
    .prepare(
      `INSERT INTO feature_matrix
         (module_id, feature_name, category, status, description, file_paths, review_notes, next_steps, last_reviewed_at, project_id)
       VALUES (?, ?, 'Core', ?, '', '[]', '', '', '2026-08-19T00:00:00.000Z', ?)`,
    )
    .run(MODULE, featureName, status, normalizeProjectId(projectPath));
}

function insertSnapshot(projectPath: string, implemented: number, reviewedAt: string) {
  getDb()
    .prepare(
      `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, partial, missing, unknown, avg_quality, project_id)
       VALUES (?, ?, 10, ?, 0, 0, 0, 4, ?)`,
    )
    .run(MODULE, reviewedAt, implemented, normalizeProjectId(projectPath));
}

function req(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/game-design-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function doc(res: Response): Promise<GDDDocument> {
  const json = (await res.json()) as { success: boolean; data?: GDDDocument; error?: string };
  expect(json.success, json.error ?? '').toBe(true);
  return json.data!;
}

function overview(gdd: GDDDocument): string {
  return gdd.sections.find((s) => s.id === 'overview')!.content;
}

/** The bar values the roadmap trend renders, one per review snapshot the doc could see. */
function trendBars(gdd: GDDDocument): string | undefined {
  return gdd.sections.find((s) => s.id === 'roadmap')?.mermaid;
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM feature_matrix').run();
  db.prepare('DELETE FROM review_snapshots').run();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST generate — the caller\'s project scopes the synthesis', () => {
  beforeEach(() => {
    // The exact wave-16 shape: BOTH projects hold `SHARED` as their own row.
    insertFeature(SHARED, PROJECT_A);
    insertFeature(SHARED, PROJECT_B);
    insertFeature(A_ONLY, PROJECT_A);
    insertFeature(LEGACY, ''); // never attributed — visible to every project
  });

  it('counts a feature two projects both hold exactly ONCE', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {}, projectPath: PROJECT_A,
    })));

    // A's own two rows + the unattributed legacy one. B's copy of SHARED is not ours.
    expect(gdd.stats.totalFeatures).toBe(3);
    expect(gdd.stats.implementedFeatures).toBe(3);
  });

  it('accepts `projectId` as well as `projectPath` (one identity, two spellings)', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {}, projectId: PROJECT_A,
    })));
    expect(gdd.stats.totalFeatures).toBe(3);
  });

  it('normalizes the path it is handed, so casing/separators cannot fork the scope', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {},
      projectPath: PROJECT_A.replace(/\\/g, '/').toUpperCase() + '/',
    })));
    expect(gdd.stats.totalFeatures).toBe(3);
    expect(gdd.scope).toEqual({ projectId: normalizeProjectId(PROJECT_A), scoped: true });
  });

  it('shows the OTHER project only its own rows', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'Jinx', checklist: {}, projectPath: PROJECT_B,
    })));
    // B holds SHARED + the legacy row; A_ONLY is not B's.
    expect(gdd.stats.totalFeatures).toBe(2);
  });

  it('still produces the GLOBAL count when no project is stated', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {},
    })));
    // 4 rows in the table — the shared feature counted once per project. This is the
    // documented legacy behaviour; the point is that the document SAYS so (below).
    expect(gdd.stats.totalFeatures).toBe(4);
    expect(gdd.scope).toEqual({ projectId: '', scoped: false });
  });
});

describe('GET — the read-only consumer path is scopable too', () => {
  beforeEach(() => {
    insertFeature(SHARED, PROJECT_A);
    insertFeature(SHARED, PROJECT_B);
  });

  it('scopes to `?projectId=`', async () => {
    const gdd = await doc(await GET(req(`/api/game-design-doc?projectName=PoF&projectId=${encodeURIComponent(PROJECT_A)}`)));
    expect(gdd.stats.totalFeatures).toBe(1);
    expect(gdd.scope?.scoped).toBe(true);
  });

  it('scopes to `?projectPath=` (the spelling the rest of the app passes around)', async () => {
    const gdd = await doc(await GET(req(`/api/game-design-doc?projectName=PoF&projectPath=${encodeURIComponent(PROJECT_B)}`)));
    expect(gdd.stats.totalFeatures).toBe(1);
  });

  it('stays global when neither is given (the pof_gdd MCP tool today)', async () => {
    const gdd = await doc(await GET(req('/api/game-design-doc?projectName=PoF')));
    expect(gdd.stats.totalFeatures).toBe(2);
    expect(gdd.scope?.scoped).toBe(false);
  });
});

describe('the review trend is scoped with the counts, not left global', () => {
  it('plots this project\'s latest snapshot, not another project\'s newer one', async () => {
    insertFeature(A_ONLY, PROJECT_A);
    insertSnapshot(PROJECT_A, 3, '2026-08-01T00:00:00.000Z');
    insertSnapshot(PROJECT_B, 9, '2026-08-18T00:00:00.000Z'); // newer, and NOT ours

    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {}, projectPath: PROJECT_A,
    })));

    // 3/10 = 30%. B's 9/10 = 90% must not appear on A's trend.
    expect(trendBars(gdd)).toContain('bar [30]');
    expect(trendBars(gdd)).not.toContain('90');
  });
});

describe('a document states which rows it was built from', () => {
  beforeEach(() => {
    insertFeature(SHARED, PROJECT_A);
    insertFeature(SHARED, PROJECT_B);
  });

  it('a GLOBAL document says so, and says what it does to the counts', async () => {
    const gdd = await doc(await POST(postReq({ action: 'generate', projectName: 'PoF', checklist: {} })));
    const text = overview(gdd);
    expect(text).toContain('Data scope:');
    expect(text).toContain('GLOBAL');
    expect(text).toMatch(/once per project/i);
  });

  it('a scoped document names the project instead of implying the global view', async () => {
    const gdd = await doc(await POST(postReq({
      action: 'generate', projectName: 'PoF', checklist: {}, projectPath: PROJECT_A,
    })));
    const text = overview(gdd);
    expect(text).toContain('Data scope:');
    expect(text).toContain(normalizeProjectId(PROJECT_A));
    expect(text).not.toContain('GLOBAL');
  });

  it('carries the scope into every export, because the exports format THIS instance', async () => {
    const gdd = await doc(await POST(postReq({ action: 'generate', projectName: 'PoF', checklist: {} })));

    const mdRes = await POST(postReq({ action: 'export-markdown', document: gdd }));
    const md = (await mdRes.json()) as { success: boolean; data: { markdown: string } };
    expect(md.success).toBe(true);
    expect(md.data.markdown).toContain('GLOBAL');

    const pitchRes = await POST(postReq({ action: 'export-pitch', document: gdd }));
    const pitch = (await pitchRes.json()) as { success: boolean; data: { html: string } };
    expect(pitch.success).toBe(true);
    expect(pitch.data.html).toContain('Data scope');
  });
});
