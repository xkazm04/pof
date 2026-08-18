/**
 * GET /api/pipeline-artifacts/changes — "what moved since I was last here", from stored rows
 * and stored revisions ONLY.
 *
 * The value of this endpoint is entirely in what it refuses to claim: a version is archived
 * only when a write CHANGED the content, so archived-since is proof of a content change and
 * its absence proves nothing at all. And the history is capped, so a churned step's count is
 * a floor — which the response must SAY rather than under-report in silence.
 *
 * (Lives under `__tests__/lib` rather than `__tests__/api` only because of this session's
 * write-set boundaries — it is an API route test.)
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-changes-${process.pid}.db`;
});
import { GET } from '@/app/api/pipeline-artifacts/changes/route';
import type { CatalogChanges } from '@/app/api/pipeline-artifacts/changes/route';
import { upsertArtifact, MAX_REVISIONS } from '@/lib/pipeline-artifacts-db';

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/pipeline-artifacts/changes?${qs}`));

const write = (entityId: string, step: string, body: string, status: 'pass' | 'fail' = 'pass') =>
  upsertArtifact({ catalogId: 'chg-test', entityId, step, data: { body }, ueAssets: [], status, tier: 'L0' });

const PAST = new Date(Date.now() - 3600_000).toISOString();
const FUTURE = new Date(Date.now() + 3600_000).toISOString();

const body = async (res: Response) => (await res.json()) as { success: boolean; data: CatalogChanges; error?: string };

describe('GET /api/pipeline-artifacts/changes', () => {
  it('separates a PROVEN content change from a bare re-write', async () => {
    write('e1', 'Once', 'v1');                       // one write, nothing archived
    write('e1', 'Twice', 'v1'); write('e1', 'Twice', 'v2'); // content changed → 1 archived
    write('e1', 'Verdict', 'same', 'pass'); write('e1', 'Verdict', 'same', 'fail'); // verdict only → nothing archived

    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    expect(json.success).toBe(true);
    const byStep = new Map(json.data.rows.map((r) => [r.step, r]));

    expect(byStep.get('Twice')!.revisionsSince).toBe(1);
    // A verdict-only re-write archives nothing, so it is reported as WRITTEN — never as
    // "changed", which the store gives no basis for.
    expect(byStep.get('Verdict')!.revisionsSince).toBe(0);
    expect(byStep.get('Verdict')!.status).toBe('fail');
    expect(byStep.get('Once')!.revisionsSince).toBe(0);
    expect(json.data.rows.every((r) => r.historyTruncated === false)).toBe(true);
    expect(json.data.truncated).toBe(0);
    expect(json.data.cap).toBe(MAX_REVISIONS);
  });

  it('flags a step whose history hit the cap — the count is a floor, not a total', async () => {
    for (let i = 0; i < MAX_REVISIONS + 5; i++) write('e2', 'Churned', `v${i}`);

    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    const churned = json.data.rows.find((r) => r.step === 'Churned')!;
    expect(churned.historyTruncated).toBe(true);
    // It churned 24 times but only MAX_REVISIONS versions survive — the response must not
    // pretend to know the rest.
    expect(churned.revisionsSince).toBe(MAX_REVISIONS);
    expect(json.data.truncated).toBeGreaterThan(0);
  });

  it('returns nothing for a baseline AFTER the writes (no invented movement)', async () => {
    write('e3', 'StepA', 'v1');
    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(FUTURE)}`));
    expect(json.data.rows).toEqual([]);
    expect(json.data.since).toBe(FUTURE);
  });

  it('refuses to invent a baseline', async () => {
    const missing = await get('catalogId=chg-test');
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toContain('no digest without a baseline');

    const bad = await get('catalogId=chg-test&since=not-a-date');
    expect(bad.status).toBe(400);

    const noCatalog = await get(`since=${encodeURIComponent(PAST)}`);
    expect(noCatalog.status).toBe(400);
  });
});
