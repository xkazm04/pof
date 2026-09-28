import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-revisions-route-${process.pid}.db`;
});

// Pass-through spies: every existing case runs the REAL grade + upsert; the dry-run cases
// override gradeArtifact per call and count upserts (a dry run must write nothing).
vi.mock('@/lib/catalog/headless', async (orig) => {
  const real = await orig<typeof import('@/lib/catalog/headless')>();
  return { ...real, gradeArtifact: vi.fn(real.gradeArtifact) };
});
vi.mock('@/lib/pipeline-artifacts-db', async (orig) => {
  const real = await orig<typeof import('@/lib/pipeline-artifacts-db')>();
  return { ...real, upsertArtifact: vi.fn(real.upsertArtifact) };
});

import { GET, POST } from '@/app/api/pipeline-artifacts/revisions/route';
import { upsertArtifact, listRevisions, getArtifact } from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';
import { gradeArtifact } from '@/lib/catalog/headless';

const CAT = 'rev-route-test'; // unregistered catalog → no server checker → statuses kept
const ENT = 'e1';
const STEP = 'Concept Brief';

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/pipeline-artifacts/revisions?${qs}`));
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/pipeline-artifacts/revisions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

beforeEach(() => {
  listRevisions(CAT, ENT, STEP); // force the lazy DDL
  const db = getDb();
  db.prepare('DELETE FROM pipeline_artifacts WHERE catalog_id = ?').run(CAT);
  db.prepare('DELETE FROM pipeline_artifact_revisions WHERE catalog_id = ?').run(CAT);
});

const write = (brief: string, status = 'pass') =>
  upsertArtifact({ catalogId: CAT, entityId: ENT, step: STEP, data: { brief }, ueAssets: [], status: status as 'pass', tier: 'L0' });

describe('GET /api/pipeline-artifacts/revisions', () => {
  it('requires all three identifiers', async () => {
    expect((await get('catalogId=x&entityId=y')).status).toBe(400);
    expect((await get('catalogId=x&step=z')).status).toBe(400);
  });

  it('returns an empty list for a step with no superseded versions', async () => {
    write('v1');
    const body = await (await get(`catalogId=${CAT}&entityId=${ENT}&step=${encodeURIComponent(STEP)}`)).json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns superseded versions newest-first', async () => {
    write('v1'); write('v2'); write('v3');
    const body = await (await get(`catalogId=${CAT}&entityId=${ENT}&step=${encodeURIComponent(STEP)}`)).json();
    expect(body.data.map((r: { data: { brief: string } }) => r.data.brief)).toEqual(['v2', 'v1']);
  });
});

describe('POST /api/pipeline-artifacts/revisions (restore)', () => {
  it('rejects a missing or non-numeric revisionId', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ revisionId: 'abc' })).status).toBe(400);
    expect((await post({ revisionId: -1 })).status).toBe(400);
  });

  it('404s for an unknown revision', async () => {
    const res = await post({ revisionId: 999999 });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it('restores the archived version as the live artifact', async () => {
    write('v1'); write('v2');
    const [rev] = listRevisions(CAT, ENT, STEP);
    expect(getArtifact(CAT, ENT, STEP)?.data).toEqual({ brief: 'v2' });

    const body = await (await post({ revisionId: rev.id })).json();
    expect(body.success).toBe(true);
    expect(body.data.artifact.data).toEqual({ brief: 'v1' });
    expect(getArtifact(CAT, ENT, STEP)?.data).toEqual({ brief: 'v1' });
  });

  it('archives the version it replaced — a restore is itself undoable', async () => {
    write('v1'); write('v2');
    const [rev] = listRevisions(CAT, ENT, STEP);
    await post({ revisionId: rev.id });

    // v2 (the version the restore displaced) is now in the history.
    const revs = listRevisions(CAT, ENT, STEP);
    expect(revs[0].data).toEqual({ brief: 'v2' });
  });

  it('reports the archived status so a changed verdict is never silent', async () => {
    write('v1', 'fail'); write('v2', 'pass');
    const [rev] = listRevisions(CAT, ENT, STEP);
    const body = await (await post({ revisionId: rev.id })).json();
    expect(body.data.archivedStatus).toBe('fail');
    expect(typeof body.data.regraded).toBe('boolean');
  });
});

describe('POST /api/pipeline-artifacts/revisions { dryRun: true } (compare before restore)', () => {
  const upsertSpy = vi.mocked(upsertArtifact);
  const gradeSpy = vi.mocked(gradeArtifact);

  it('re-grades the archived data and returns the RAW would-status — upsertArtifact is called 0 times', async () => {
    write('v1', 'fail'); write('v2', 'pass');
    const [rev] = listRevisions(CAT, ENT, STEP);
    const raw = { label: 'brief', detail: 'ok', status: 'pass' as const, tier: 'L1' as const };
    gradeSpy.mockReturnValueOnce({ graded: true, raw, result: { ...raw, status: 'fail' as const } });
    upsertSpy.mockClear();

    const res = await post({ revisionId: rev.id, dryRun: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ regraded: true, wouldStatus: 'pass', wouldTier: 'L1', archivedStatus: 'fail' });
    expect(upsertSpy).toHaveBeenCalledTimes(0);
    // Nothing moved: the live row and the history are exactly as before.
    expect(getArtifact(CAT, ENT, STEP)?.data).toEqual({ brief: 'v2' });
    expect(listRevisions(CAT, ENT, STEP)).toHaveLength(1);
  });

  it('a step with no server checker keeps the archived verdict and SAYS so — never a fabricated pass', async () => {
    write('v1', 'fail'); write('v2', 'pass');
    const [rev] = listRevisions(CAT, ENT, STEP);
    upsertSpy.mockClear();

    const body = await (await post({ revisionId: rev.id, dryRun: true })).json();
    expect(body.data.regraded).toBe(false);
    expect(body.data.wouldStatus).toBe('fail');
    expect(body.data.wouldReason).toMatch(/no server checker/i);
    expect(upsertSpy).toHaveBeenCalledTimes(0);
  });

  it('[guard] without dryRun the restore upserts exactly once and keeps {artifact, regraded, archivedStatus}', async () => {
    write('v1', 'fail'); write('v2', 'pass');
    const [rev] = listRevisions(CAT, ENT, STEP);
    upsertSpy.mockClear();

    const body = await (await post({ revisionId: rev.id })).json();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(body.data.artifact.data).toEqual({ brief: 'v1' });
    expect(body.data.regraded).toBe(false);
    expect(body.data.archivedStatus).toBe('fail');
  });
});
