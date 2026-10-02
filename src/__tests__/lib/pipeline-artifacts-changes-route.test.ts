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

// A fresh directory per FILE run (not per pid): a pid-named DB can be reused by a later run
// that recycles the pid, and its leftover rows then leak into this file's catalog.
await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-test-artifact-changes-'));
  process.env.POF_DB_PATH = path.join(dir, 'pof.db');
});
import { GET } from '@/app/api/pipeline-artifacts/changes/route';
import type { CatalogChanges } from '@/app/api/pipeline-artifacts/changes/route';
import { upsertArtifact, MAX_REVISIONS } from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/pipeline-artifacts/changes?${qs}`));

const write = (entityId: string, step: string, body: string, status: 'pass' | 'fail' | 'deferred' = 'pass') =>
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

  // -- What the step WAS: the verdict archived with the version its first change replaced --

  it('carries priorStatus from the first version archived after the baseline', async () => {
    write('p1', 'Broke', 'v1', 'pass'); write('p1', 'Broke', 'v2', 'fail'); // pass archived, live fail
    write('p1', 'Fixed', 'v1', 'deferred'); write('p1', 'Fixed', 'v2', 'fail'); write('p1', 'Fixed', 'v3', 'pass');
    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    const byStep = new Map(json.data.rows.filter((r) => r.entityId === 'p1').map((r) => [r.step, r]));
    expect(byStep.get('Broke')!.status).toBe('fail');
    expect(byStep.get('Broke')!.priorStatus).toBe('pass');
    // The EARLIEST archive after the baseline, not the latest: what it held before it moved.
    expect(byStep.get('Fixed')!.priorStatus).toBe('deferred');
    expect(json.data.catalogId).toBe('chg-test');
  });

  it('omits priorStatus when nothing was archived after the baseline', async () => {
    write('p2', 'Once', 'v1', 'fail');
    write('p2', 'Verdict', 'same', 'pass'); write('p2', 'Verdict', 'same', 'fail');
    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    const mine = json.data.rows.filter((r) => r.entityId === 'p2');
    expect(mine).toHaveLength(2);
    for (const r of mine) expect('priorStatus' in r).toBe(false);
  });

  it('omits priorStatus at the cap when every surviving version post-dates the baseline (the baseline version may be pruned)', async () => {
    for (let i = 0; i < MAX_REVISIONS + 3; i++) write('p3', 'Churned', `v${i}`, i === 0 ? 'pass' : 'fail');
    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    const churned = json.data.rows.find((r) => r.entityId === 'p3' && r.step === 'Churned')!;
    expect(churned.historyTruncated).toBe(true);
    expect('priorStatus' in churned).toBe(false);
  });

  it('keeps priorStatus at the cap when a surviving version predates the baseline (nothing after it was pruned)', async () => {
    // 23 writes archive v0..v21; the cap keeps v2..v21. v2..v8 deferred, v9 fail, v10.. pass.
    for (let i = 0; i < MAX_REVISIONS + 3; i++) write('p4', 'Churned', `v${i}`, i < 9 ? 'deferred' : i === 9 ? 'fail' : 'pass');
    const db = getDb();
    const ids = (db.prepare(`SELECT id FROM pipeline_artifact_revisions WHERE catalog_id = 'chg-test' AND entity_id = 'p4' ORDER BY id ASC`)
      .all() as { id: number }[]).map((r) => r.id);
    expect(ids).toHaveLength(MAX_REVISIONS);
    // Back-date the 7 oldest survivors (v2..v8) to before the baseline: the first archive after
    // it (v9) is then provably the earliest, so its verdict is on record.
    const old = new Date(Date.now() - 2 * 3600_000).toISOString();
    for (const id of ids.slice(0, 7)) db.prepare('UPDATE pipeline_artifact_revisions SET archived_at = ? WHERE id = ?').run(old, id);
    const json = await body(await get(`catalogId=chg-test&since=${encodeURIComponent(PAST)}`));
    const churned = json.data.rows.find((r) => r.entityId === 'p4' && r.step === 'Churned')!;
    expect(churned.historyTruncated).toBe(true);
    expect(churned.revisionsSince).toBe(MAX_REVISIONS - 7);
    expect(churned.priorStatus).toBe('fail');
  });
});
