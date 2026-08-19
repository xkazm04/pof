/**
 * The operator's fixture purge — the one action that removes the test harness's residue from
 * the real database, and reports exactly what it removed.
 *
 * The GET must be a true dry run (nothing deleted by looking) and the POST must be impossible
 * to fire without having read that dry run's number, because the rows are evidence of a defect
 * an operator may still be investigating.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-purge-fixtures-route-${process.pid}.db`;
});

import { GET, POST } from '@/app/api/pipeline-artifacts/purge-fixtures/route';
import { upsertArtifact, listArtifacts } from '@/lib/pipeline-artifacts-db';
import { upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

const CAT = 'purge-route-test';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/pipeline-artifacts/purge-fixtures', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));

function seed(entityId: string) {
  upsertArtifact({ catalogId: CAT, entityId, step: 'Alpha', data: { v: 1 }, ueAssets: [], status: 'pass', tier: 'L0' });
  upsertVerdict({
    catalogId: CAT, entityId, step: 'Alpha', judge: 'llm-panel', verdict: 'fail', score: 5,
    findings: 'fixture', model: 'test', rubricVersion: RUBRIC_VERSION,
  });
}

describe('GET/POST /api/pipeline-artifacts/purge-fixtures', () => {
  it('GET reports what would go, per entity and per table, and deletes nothing', async () => {
    seed('test-headless-mcp');
    seed('hero-real');

    const json = await (await GET()).json();
    expect(json.success).toBe(true);
    expect(json.data.purged).toBe(false);
    expect(json.data.entities.map((e: { entityId: string }) => e.entityId)).toEqual(['test-headless-mcp']);
    // 1 artifact + 1 verdict + 1 history row; no revision (produced once).
    expect(json.data.entities[0].counts).toEqual({ artifacts: 1, revisions: 0, verdicts: 1, verdictHistory: 1 });
    expect(json.data.totalRows).toBe(3);
    expect(listArtifacts(CAT, 'test-headless-mcp')).toHaveLength(1);
  });

  it('POST without expectRows refuses — a purge can never run unseen', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expectRows/);
    expect(listArtifacts(CAT, 'test-headless-mcp')).toHaveLength(1);
  });

  it('POST with a stale expectRows refuses with 409 naming both numbers', async () => {
    const res = await post({ expectRows: 999 });
    expect(res.status).toBe(409);
    const err = (await res.json()).error as string;
    expect(err).toContain('999');
    expect(err).toContain('3');
    expect(listArtifacts(CAT, 'test-headless-mcp')).toHaveLength(1);
  });

  it('POST with the confirmed count purges and reports the real per-table counts', async () => {
    const json = await (await post({ expectRows: 3 })).json();
    expect(json.success).toBe(true);
    expect(json.data.purged).toBe(true);
    expect(json.data.totalRows).toBe(3);
    expect(json.data.total).toEqual({ artifacts: 1, revisions: 0, verdicts: 1, verdictHistory: 1 });

    expect(listArtifacts(CAT, 'test-headless-mcp')).toHaveLength(0);
    // The real entity is untouched.
    expect(listArtifacts(CAT, 'hero-real')).toHaveLength(1);

    // A second purge reports honest zeros rather than repeating the first run's numbers.
    const again = await (await post({ expectRows: 0 })).json();
    expect(again.data.totalRows).toBe(0);
  });
});
