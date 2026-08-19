/**
 * `DELETE /api/pipeline-artifacts` must remove ALL FOUR tables a step writes into, and report
 * the rows that actually went.
 *
 * It used to `deleteArtifact` the live row only and return `targets.length` — the number of
 * rows ATTEMPTED — under a docstring promising "the number of rows actually removed". So the
 * lab's Reset left the judge's verdict and the entire revision archive behind: re-produce the
 * step and a verdict that had read content it no longer held condemned it again.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-delete-all-tables-${process.pid}.db`;
});

import { DELETE } from '@/app/api/pipeline-artifacts/route';
import { upsertArtifact, listRevisions } from '@/lib/pipeline-artifacts-db';
import { upsertVerdict, listVerdicts, listVerdictHistory } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

const CAT = 'delete-all-tables-test';

const del = (qs: string) =>
  DELETE(new NextRequest(`http://localhost/api/pipeline-artifacts?${qs}`, { method: 'DELETE' }));

describe('DELETE /api/pipeline-artifacts removes every table the step wrote to', () => {
  it('reports real per-table counts and leaves no revision or verdict behind', async () => {
    // Produce twice with different content → 1 live row + 1 archived revision.
    upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'Alpha', data: { v: 1 }, ueAssets: [], status: 'pass', tier: 'L0' });
    upsertArtifact({ catalogId: CAT, entityId: 'e1', step: 'Alpha', data: { v: 2 }, ueAssets: [], status: 'pass', tier: 'L0' });
    // Judge twice → 1 current verdict + 2 history rows.
    for (const score of [30, 60]) {
      upsertVerdict({
        catalogId: CAT, entityId: 'e1', step: 'Alpha', judge: 'llm-panel', verdict: 'fail', score,
        findings: 'seed', model: 'test', rubricVersion: RUBRIC_VERSION,
      });
    }
    expect(listRevisions(CAT, 'e1', 'Alpha')).toHaveLength(1);
    expect(listVerdictHistory(CAT, 'e1', 'Alpha')).toHaveLength(2);

    const json = await (await del(`catalogId=${CAT}&entityId=e1`)).json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ deleted: 1, artifacts: 1, revisions: 1, verdicts: 1, verdictHistory: 2 });

    expect(listRevisions(CAT, 'e1', 'Alpha')).toHaveLength(0);
    expect(listVerdictHistory(CAT, 'e1', 'Alpha')).toHaveLength(0);
    expect(listVerdicts(CAT).filter((v) => v.entityId === 'e1')).toHaveLength(0);
  });

  it('reports 0 — not 1 — when the named step was never produced', async () => {
    const json = await (await del(`catalogId=${CAT}&entityId=never&step=Nothing`)).json();
    expect(json.data).toMatchObject({ deleted: 0, artifacts: 0, revisions: 0, verdicts: 0, verdictHistory: 0 });
  });
});
