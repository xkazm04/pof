/**
 * /api/craft-verdicts + craft-verdicts-db — the A-axis write/read seam.
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-craft-verdicts-${process.pid}.db`;
});
import { GET, POST } from '@/app/api/craft-verdicts/route';
import {
  listCraftVerdicts,
  rowToCraftVerdict,
  PROCESS_ENTITY,
  PROCESS_STEP,
  type CraftVerdict,
} from '@/lib/craft/craft-verdicts-db';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/craft-verdicts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE = {
  catalogId: 'items',
  entityId: 'iron-sword',
  step: 'Concept Brief',
  lens: 'game-systems-code',
  lensVersion: 1,
  model: 'opus-craft-fleet-test',
};

describe('POST /api/craft-verdicts', () => {
  it('rejects a below-A4 gauge with no findings', async () => {
    const res = await POST(post({ ...BASE, aLevel: 'A2', findings: [] }));
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain('finding');
  });

  it('rejects findings without a named criterion or routing class', async () => {
    const res = await POST(
      post({ ...BASE, aLevel: 'A2', findings: [{ criterion: '', detail: 'long enough detail', class: 'content' }] }),
    );
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  it('rejects a step gauge under the production-process lens and vice versa', async () => {
    const asStep = await POST(
      post({ ...BASE, lens: 'production-process', aLevel: 'A2', findings: [{ criterion: 'x', detail: 'long enough detail', class: 'ux' }] }),
    );
    expect(((await asStep.json()) as { success: boolean }).success).toBe(false);

    const asProcess = await POST(
      post({ ...BASE, entityId: PROCESS_ENTITY, step: PROCESS_STEP, lens: 'game-systems-code', aLevel: 'A2', findings: [{ criterion: 'x', detail: 'long enough detail', class: 'ux' }] }),
    );
    expect(((await asProcess.json()) as { success: boolean }).success).toBe(false);
  });

  it('stamps the staleness anchor from the artifact on record', async () => {
    upsertArtifact({
      catalogId: BASE.catalogId,
      entityId: BASE.entityId,
      step: BASE.step,
      status: 'pass',
      tier: 'L0',
      data: { brief: 'x' },
      ueAssets: [],
    });
    const res = await POST(
      post({
        ...BASE,
        aLevel: 'A2',
        findings: [{ criterion: 'systemic-depth', detail: 'no interlocking systems named', class: 'content' }],
      }),
    );
    const json = (await res.json()) as { success: boolean; data: CraftVerdict };
    expect(json.success).toBe(true);
    expect(json.data.artifactUpdatedAt).toBeTruthy();

    const stored = listCraftVerdicts(BASE.catalogId);
    expect(stored).toHaveLength(1);
    expect(stored[0].aLevel).toBe('A2');
    expect(stored[0].findings[0].class).toBe('content');
    expect(stored[0].artifactUpdatedAt).toBe(json.data.artifactUpdatedAt);
  });

  it('a process scorecard stores with no anchor (staleness unknown, never fabricated)', async () => {
    const res = await POST(
      post({
        catalogId: 'items',
        entityId: PROCESS_ENTITY,
        step: PROCESS_STEP,
        lens: 'production-process',
        lensVersion: 1,
        aLevel: 'A1',
        findings: [{ criterion: 'human-review-gates', detail: 'no art-director pick surface before packaging', class: 'ux' }],
        model: 'opus-craft-fleet-test',
      }),
    );
    const json = (await res.json()) as { success: boolean; data: CraftVerdict };
    expect(json.success).toBe(true);
    expect(json.data.artifactUpdatedAt).toBeUndefined();
  });

  it('upsert replaces the current gauge for the same step', async () => {
    await POST(
      post({ ...BASE, aLevel: 'A3', findings: [{ criterion: 'systemic-depth', detail: 'improved but still shallow economy hooks', class: 'content' }] }),
    );
    const stored = listCraftVerdicts(BASE.catalogId).filter((v) => v.step === BASE.step);
    expect(stored).toHaveLength(1);
    expect(stored[0].aLevel).toBe('A3');
  });
});

describe('GET /api/craft-verdicts', () => {
  it('lists all and filters by catalogId', async () => {
    const all = (await (await GET(new NextRequest('http://localhost/api/craft-verdicts'))).json()) as {
      success: boolean;
      data: CraftVerdict[];
    };
    expect(all.success).toBe(true);
    expect(all.data.length).toBeGreaterThanOrEqual(2);

    const none = (await (
      await GET(new NextRequest('http://localhost/api/craft-verdicts?catalogId=no-such'))
    ).json()) as { data: CraftVerdict[] };
    expect(none.data).toHaveLength(0);
  });
});

describe('rowToCraftVerdict', () => {
  it('tolerates malformed findings JSON (yields [], never throws)', () => {
    const v = rowToCraftVerdict({
      catalog_id: 'c',
      entity_id: 'e',
      step: 's',
      lens: 'audio',
      lens_version: 1,
      a_level: 'A2',
      findings: '{not json',
      model: 'm',
    });
    expect(v.findings).toEqual([]);
  });
});
