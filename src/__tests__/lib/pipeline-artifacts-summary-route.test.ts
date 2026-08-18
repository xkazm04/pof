/**
 * GET /api/pipeline-artifacts/summary — the blob-free read of the same rows.
 *
 * It exists because the lab's cross-catalog coach reads EVERY registered catalog on first
 * paint. Measured on the real `~/.pof/pof.db` (817 artifacts / 33 catalogs): the full route
 * answers that with 7.41 MB of produce bodies, this one with 134 KB. The contract these cases
 * hold is that the projection carries no blob and invents no hash rule.
 *
 * (Lives under `__tests__/lib` rather than `__tests__/api` only because of this session's
 * write-set boundaries — it is an API route test.)
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Isolate from the user's real ~/.pof/pof.db (see pipeline-artifacts-delete.test.ts).
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-summary-${process.pid}.db`;
});
import { GET } from '@/app/api/pipeline-artifacts/summary/route';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';
import { labContentHash } from '@/components/layout-lab/labContentDrift';

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/pipeline-artifacts/summary?${qs}`));

const DATA = { brief: 'a'.repeat(2000), nested: { deep: [1, 2, 3] } };

const seed = (entityId: string, step: string, status: 'pass' | 'fail' | 'deferred' = 'pass') =>
  upsertArtifact({
    catalogId: 'sum-test', entityId, step, data: DATA, ueAssets: ['/Game/B', '/Game/A'],
    status, tier: 'L2', reason: status === 'pass' ? undefined : 'gate not run',
  });

describe('GET /api/pipeline-artifacts/summary', () => {
  it('returns the verdict per (entity, step) and NO data/ueAssets blobs', async () => {
    seed('e1', 'Alpha');
    seed('e1', 'Beta', 'deferred');

    const res = await get('catalogId=sum-test&entityId=e1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const rows = json.data as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).not.toHaveProperty('data');
      expect(r).not.toHaveProperty('ueAssets');
      expect(r.entityId).toBe('e1');
      expect(typeof r.updatedAt).toBe('string');
    }
    const beta = rows.find((r) => r.step === 'Beta')!;
    expect(beta).toMatchObject({ status: 'deferred', tier: 'L2', reason: 'gate not run' });

    // The whole payload is a fraction of one produce body.
    expect(JSON.stringify(rows).length).toBeLessThan(JSON.stringify(DATA).length);
  });

  it('carries the SHARED hashes — the judge binding and the drift fingerprint', async () => {
    seed('e2', 'Alpha');
    const rows = (await (await get('catalogId=sum-test&entityId=e2')).json()).data as Record<string, unknown>[];
    expect(rows[0].contentHash).toBe(stepContentHash(DATA));
    expect(rows[0].driftHash).toBe(labContentHash(DATA, ['/Game/B', '/Game/A']));
  });

  it('covers the whole catalog when no entity is given', async () => {
    seed('e3', 'Alpha');
    const rows = (await (await get('catalogId=sum-test')).json()).data as { entityId: string }[];
    expect(new Set(rows.map((r) => r.entityId)).size).toBeGreaterThan(1);
  });

  it('requires catalogId', async () => {
    const res = await get('');
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });
});
