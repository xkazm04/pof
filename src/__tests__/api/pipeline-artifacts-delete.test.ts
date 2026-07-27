/**
 * DELETE /api/pipeline-artifacts — the server half of the lab's "Reset". Without it a
 * reset cleared local state only and the surviving server rows were re-adopted by the
 * add-only hydration, silently un-doing the reset.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Isolate from the user's real ~/.pof/pof.db (see pipeline-artifacts-post.test.ts).
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifacts-delete-${process.pid}.db`;
});
import { DELETE } from '@/app/api/pipeline-artifacts/route';
import { upsertArtifact, listArtifacts } from '@/lib/pipeline-artifacts-db';

const del = (qs: string) => DELETE(new NextRequest(`http://localhost/api/pipeline-artifacts?${qs}`, { method: 'DELETE' }));

const seed = (entityId: string, step: string) =>
  upsertArtifact({ catalogId: 'del-test', entityId, step, data: {}, ueAssets: [], status: 'pass', tier: 'L0' });

describe('DELETE /api/pipeline-artifacts', () => {
  it('deletes every step of one entity and leaves other entities alone', async () => {
    seed('e1', 'Alpha'); seed('e1', 'Beta'); seed('e2', 'Alpha');

    const res = await del('catalogId=del-test&entityId=e1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.deleted).toBe(2);

    expect(listArtifacts('del-test', 'e1')).toHaveLength(0);
    expect(listArtifacts('del-test', 'e2')).toHaveLength(1);
  });

  it('deletes a single step when `step` is given', async () => {
    seed('e3', 'Alpha'); seed('e3', 'Beta');
    const json = await (await del('catalogId=del-test&entityId=e3&step=Alpha')).json();
    expect(json.data.deleted).toBe(1);
    expect(listArtifacts('del-test', 'e3').map((a) => a.step)).toEqual(['Beta']);
  });

  it('requires entityId — there is no whole-catalog wipe surface', async () => {
    const res = await del('catalogId=del-test');
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });
});
