/**
 * The UE5 auto-verify write path stamps the active project.
 *
 * `autoUpdateFeatureMatrix` was the ONE feature-matrix write path left unstamped
 * after project scoping: it GET-ed `/api/feature-matrix?moduleId=…` with no scope and
 * POST-ed a body with no `projectId`, so every verdict derived from a live UE5 asset
 * manifest landed unattributed (`project_id = ''`) — visible to every project, and a
 * continuing source of exactly the unattributed rows the scoping work exists to end.
 *
 * RED BEFORE THIS CHANGE:
 *   • "an auto-verify under project A is NOT returned to project B" — the row was
 *     written with `project_id = ''`, which every named project can see;
 *   • "the manifest read is scoped the same way the write is" — the GET had no
 *     `projectId`, so the diff was taken against the LEGACY set while the write
 *     landed (post-fix) under the project.
 *
 * Runs the real route handlers against the real SQLite schema (throwaway DB) with
 * `fetch` dispatched into them, so nothing about the write path is mocked away.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-verify-scope-${process.pid}.db`;
});

import { GET, POST } from '@/app/api/feature-matrix/route';
import { autoUpdateFeatureMatrix } from '@/lib/pof-bridge/verification-engine';
import { getFeaturesByModule, normalizeProjectId } from '@/lib/feature-matrix-db';
import { getDb } from '@/lib/db';
import type { AssetManifest, VerificationRule } from '@/types/pof-bridge';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const FEATURE = 'Verify-scope probe feature';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

const RULES: VerificationRule[] = [
  {
    featureName: FEATURE,
    moduleId: MODULE,
    // Deterministic: the manifest below always carries assets, so the rule always
    // says `implemented`. The subject under test is the SCOPE, not the check.
    check: (m: AssetManifest) => (m.assetCount > 0 ? 'implemented' : 'missing'),
  },
];

const MANIFEST: AssetManifest = {
  version: 1,
  generatedAt: '2026-08-19T00:00:00.000Z',
  projectName: 'PoF',
  engineVersion: '5.8',
  assetCount: 3,
  checksumSha256: 'deadbeef',
  blueprints: [],
  materials: [],
  animAssets: [],
  dataTables: [],
  otherAssets: [],
};

/** Dispatch the relative-URL fetches `tryApiFetch` issues straight into the real
 *  route handlers — no network, no mocked write path. */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : String(input);
  if (!url.startsWith('/api/feature-matrix')) {
    throw new Error(`unexpected fetch in test: ${url}`);
  }
  const request = new NextRequest(`http://localhost${url}`, {
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body as string | undefined,
  });
  return init?.method === 'POST' ? POST(request) : GET(request);
}) as typeof globalThis.fetch;

afterAll(() => {
  globalThis.fetch = realFetch;
});

function storedProjectIds(): string[] {
  return (
    getDb()
      .prepare('SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
      .all(MODULE, FEATURE) as { project_id: string }[]
  ).map((r) => r.project_id);
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM feature_matrix WHERE module_id = ?').run(MODULE);
  db.prepare('DELETE FROM review_snapshots WHERE module_id = ?').run(MODULE);
});

describe('autoUpdateFeatureMatrix stamps the project it verified', () => {
  it('an auto-verify under project A is NOT returned to project B', async () => {
    const results = await autoUpdateFeatureMatrix(MANIFEST, MODULE, RULES, PROJECT_A);
    expect(results).toHaveLength(1);
    expect(results[0].newStatus).toBe('implemented');
    expect(results[0].writeError).toBeUndefined();

    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName)).toEqual([FEATURE]);
    // RED before the fix: the row carried `''`, which every named project sees.
    expect(getFeaturesByModule(MODULE, PROJECT_B)).toHaveLength(0);
  });

  it('the stored row carries the normalized project id, not the raw path', async () => {
    await autoUpdateFeatureMatrix(MANIFEST, MODULE, RULES, PROJECT_A);
    expect(storedProjectIds()).toEqual([normalizeProjectId(PROJECT_A)]);
  });

  it('reads the current statuses through the SAME scope it writes under', async () => {
    // A row project B holds. If the pre-diff GET were unscoped it would be read as
    // A's current state and the rule would report "no change" — writing nothing.
    await autoUpdateFeatureMatrix(MANIFEST, MODULE, RULES, PROJECT_B);
    expect(getFeaturesByModule(MODULE, PROJECT_B)).toHaveLength(1);

    const results = await autoUpdateFeatureMatrix(MANIFEST, MODULE, RULES, PROJECT_A);
    // A saw no row of its own, so this IS a change for A and must persist under A.
    expect(results[0].previousStatus).toBeNull();
    expect(getFeaturesByModule(MODULE, PROJECT_A).map((f) => f.featureName)).toEqual([FEATURE]);
  });

  it('a verify with NO project still writes — unattributed, never silently adopted', async () => {
    const results = await autoUpdateFeatureMatrix(MANIFEST, MODULE, RULES);
    expect(results[0].writeError).toBeUndefined();
    // Written, and stamped with the unscoped id — counted as legacy, not attributed
    // to whatever project happened to be open.
    expect(storedProjectIds()).toEqual(['']);
  });

  it('a module with no applicable rules writes nothing at all', async () => {
    const results = await autoUpdateFeatureMatrix(MANIFEST, 'arpg-loot' as SubModuleId, RULES, PROJECT_A);
    expect(results).toEqual([]);
    expect(storedProjectIds()).toEqual([]);
  });
});
