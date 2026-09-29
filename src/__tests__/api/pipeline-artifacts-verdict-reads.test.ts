/**
 * The verdict-only routes read through `listArtifactVerdicts` — no produce body is fetched or
 * parsed to answer them.
 *
 *  - /summary must stay a pure PROJECTION: its wire rows are identical to what the old
 *    full-read computation produced (the parity guard).
 *  - /changes only ever emitted status/tier/reason/updatedAt, so one unreadable blob in a
 *    catalog must no longer 500 the whole digest.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-verdict-reads-${process.pid}-${Date.now()}.db`;
});
import { GET as summaryGET } from '@/app/api/pipeline-artifacts/summary/route';
import { GET as changesGET } from '@/app/api/pipeline-artifacts/changes/route';
import type { CatalogChanges } from '@/app/api/pipeline-artifacts/changes/route';
import { getDb } from '@/lib/db';
import { upsertArtifact, listArtifacts, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';
import { labContentHash } from '@/components/layout-lab/labContentDrift';

const CAT = 'h';
const PAST = new Date(Date.now() - 3600_000).toISOString();

/** The summary projection exactly as it was computed BEFORE the stored hash (full read + 2 hashes). */
const preChangeSummary = (a: PipelineArtifact) => ({
  entityId: a.entityId,
  step: a.step,
  status: a.status,
  ...(a.tier ? { tier: a.tier } : {}),
  ...(a.reason ? { reason: a.reason } : {}),
  ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
  contentHash: stepContentHash(a.data),
  driftHash: labContentHash(a.data, a.ueAssets),
});

describe('GET /api/pipeline-artifacts/summary (guard: wire parity)', () => {
  it('deep-equals the pre-change full-read projection, row for row', async () => {
    upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'A', data: { brief: 'x'.repeat(500), n: [1, 2] }, ueAssets: ['/Game/Z', '/Game/A'], status: 'pass', tier: 'L0' });
    upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'B', data: { brief: 'y', _provenance: { engine: 'e' } }, ueAssets: [], status: 'deferred', tier: 'L2', reason: 'queued' });
    upsertArtifact({ catalogId: CAT, entityId: 'e2', step: 'A', data: {}, ueAssets: ['/Game/Q'], status: 'fail', reason: 'nope' });

    const expected = listArtifacts(CAT).map(preChangeSummary);
    const res = await summaryGET(new NextRequest(`http://localhost/api/pipeline-artifacts/summary?catalogId=${CAT}`));
    expect(res.status).toBe(200);
    const rows = (await res.json()).data as unknown[];
    const byKey = (r: { entityId: string; step: string }) => `${r.entityId} ${r.step}`;
    const sort = <T extends { entityId: string; step: string }>(xs: T[]) => [...xs].sort((x, y) => byKey(x).localeCompare(byKey(y)));
    expect(sort(rows as { entityId: string; step: string }[])).toEqual(sort(expected));
  });
});

describe('GET /api/pipeline-artifacts/changes', () => {
  it('reports a row whose blob is unreadable instead of failing the whole catalog', async () => {
    upsertArtifact({ catalogId: 'hc', entityId: 'ok', step: 'S', data: { a: 1 }, ueAssets: [], status: 'pass', tier: 'L0' });
    getDb().prepare(`INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, status, reason, updated_at)
      VALUES ('hc', 'broken', 'S', '{not json', 'fail', 'corrupt', datetime('now'))`).run();

    const res = await changesGET(new NextRequest(`http://localhost/api/pipeline-artifacts/changes?catalogId=hc&since=${encodeURIComponent(PAST)}`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: CatalogChanges };
    const broken = json.data.rows.find((r) => r.entityId === 'broken');
    expect(broken).toMatchObject({ step: 'S', status: 'fail', reason: 'corrupt', revisionsSince: 0 });
    expect(json.data.rows.find((r) => r.entityId === 'ok')).toMatchObject({ status: 'pass', tier: 'L0' });
  });
});
