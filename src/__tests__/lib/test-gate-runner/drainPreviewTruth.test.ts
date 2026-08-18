/**
 * The drain queue-preview GET, and the honesty of what the docs claim about it.
 *
 * `docs/catalog/L3-L4-RUNNER.md` used to say the UI shows what's drainable via this GET.
 * It does not: every production caller POSTs (the lab's "Run deferred gates", the Matrix
 * batch drain, the `pof_drain_gates` MCP tool). The claim was corrected rather than the
 * preview wired, because the drain trigger sites that would render it are UI files outside
 * this change's scope — and a preview that exists only in a doc is worse than none.
 *
 * These pin BOTH halves of the correction:
 *  1. the GET really does return exactly what a drain would collect (same `collectDeferred`,
 *     same synthetic-fixture exclusion), so the doc's parity claim is true; and
 *  2. the doc's "no UI consumer" statement stays true — the moment `labArtifactClient`
 *     grows a GET against the drain endpoint, this test fails and the doc must be updated.
 *
 * Uses a throwaway DB (POF_DB_PATH set before the import graph loads).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-drain-preview-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/pipeline-artifacts/drain/route';
import { collectDeferred } from '@/lib/test-gate-runner/drain';
import { upsertArtifact, listDeferredArtifacts } from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { ApiResponse } from '@/types/api';

const CAT = 'preview-cat';

function seed(entityId: string, step: string, tier: 'L3' | 'L4' = 'L3') {
  upsertArtifact({
    catalogId: CAT, entityId, step, data: {}, ueAssets: [],
    status: 'deferred', tier, reason: 'live-UE runner not yet run: VSPreviewTest',
  });
}

async function previewJobs(query: string): Promise<GateJob[]> {
  const res = await GET(new NextRequest(`http://localhost/api/pipeline-artifacts/drain${query}`));
  const body = (await res.json()) as ApiResponse<GateJob[]>;
  expect(body.success).toBe(true);
  return (body as { success: true; data: GateJob[] }).data;
}

const key = (j: GateJob) => `${j.catalogId}/${j.entityId}/${j.step}`;

beforeEach(() => {
  listDeferredArtifacts(); // force the lazy DDL before the cleanup DELETE
  getDb().prepare('DELETE FROM pipeline_artifacts WHERE catalog_id = ?').run(CAT);
  seed('real-a', 'Test Gate');
  seed('real-b', 'Test Gate');
  seed('real-a', 'Visual Gate', 'L4');
  // A synthetic fixture entity: excluded from any BROAD sweep, collected only when named.
  seed('test-headless-1', 'Test Gate');
});

describe('drain queue preview — the GET returns exactly what the drain would run', () => {
  it('matches collectDeferred (the same function drainAll collects with) for a catalog scope', async () => {
    const preview = await previewJobs(`?catalogId=${CAT}`);
    expect(preview.map(key)).toEqual(collectDeferred({ catalogId: CAT }).map(key));
    expect(preview.length).toBeGreaterThan(0);
  });

  it('applies the IDENTICAL synthetic-fixture exclusion the drain applies', async () => {
    // Broad sweep: the fixture entity is absent from both the preview and the run set.
    const broad = await previewJobs(`?catalogId=${CAT}`);
    expect(broad.some((j) => j.entityId === 'test-headless-1')).toBe(false);
    expect(collectDeferred({ catalogId: CAT }).some((j) => j.entityId === 'test-headless-1')).toBe(false);

    // Named explicitly: BOTH include it — a fixture can still be exercised on purpose.
    const named = await previewJobs(`?catalogId=${CAT}&entityId=test-headless-1`);
    expect(named.map(key)).toEqual(collectDeferred({ catalogId: CAT, entityId: 'test-headless-1' }).map(key));
    expect(named.some((j) => j.entityId === 'test-headless-1')).toBe(true);
  });

  it('parses the same filter surface as the POST (tier, entityIds=a,b,c)', async () => {
    expect((await previewJobs(`?catalogId=${CAT}&tier=L4`)).map(key))
      .toEqual(collectDeferred({ catalogId: CAT, tier: 'L4' }).map(key));
    const batch = await previewJobs(`?catalogId=${CAT}&entityIds=real-a,real-b`);
    expect(batch.map(key)).toEqual(collectDeferred({ catalogId: CAT, entityIds: ['real-a', 'real-b'] }).map(key));
    expect(batch.every((j) => j.entityId === 'real-a' || j.entityId === 'real-b')).toBe(true);
  });
});

describe('doc truth — "no UI consumer" must not rot', () => {
  const root = resolve(__dirname, '../../../..');
  const client = readFileSync(resolve(root, 'src/components/layout-lab/labArtifactClient.ts'), 'utf8');
  const doc = readFileSync(resolve(root, 'docs/catalog/L3-L4-RUNNER.md'), 'utf8');

  // A preview consumer would be a READ of the drain endpoint: the endpoint with a query
  // string, or without a `method: 'POST'` on the same call. The two existing call sites
  // are both POSTs to the bare endpoint.
  const readsDrainQueue = /['"`]\/api\/pipeline-artifacts\/drain\?/.test(client);

  it('the lab client still only POSTs the drain (no preview fetch yet)', () => {
    expect(readsDrainQueue).toBe(false);
  });

  it('the doc says plainly that the GET has no UI consumer — or says it is wired, once it is', () => {
    if (readsDrainQueue) {
      // Someone wired the preview: the doc must no longer claim there is no UI consumer.
      expect(doc).not.toMatch(/the GET has no UI consumer/i);
    } else {
      expect(doc).toMatch(/the GET has no UI consumer/i);
      // …and it must not resurrect the old false claim.
      expect(doc).not.toMatch(/so the UI shows what's drainable/i);
    }
  });
});
