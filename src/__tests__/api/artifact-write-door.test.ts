/**
 * One artifact write door — the three route writers of NEW content go through `commitArtifact`:
 *
 *  - POST /api/catalog/step-submit   (MCP `pof_submit_artifact`) — stamps the recipe prompt version
 *  - POST /api/pipeline-artifacts    (the lab produce write-through) — now honours D18 profile scope
 *                                     and syncs the derived lifecycle, like the headless door did
 *  - POST /api/pipeline-artifacts/revisions (restore) — an ungraded restore says UNGRADED
 *
 * The persisted status stays the PURE checker verdict everywhere ([guard]).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-write-door-${process.pid}.db`;
});

import '@/lib/catalog/pipelines/registry.generated';
import { POST as postStepSubmit } from '@/app/api/catalog/step-submit/route';
import { POST as postArtifact } from '@/app/api/pipeline-artifacts/route';
import { POST as postRevision } from '@/app/api/pipeline-artifacts/revisions/route';
import { deriveCatalogLifecycle, gradeArtifact } from '@/lib/catalog/headless';
import { getArtifact, listArtifacts, listRevisions, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { getLifecycle } from '@/lib/catalog-db';
import { seededEntities } from '@/lib/catalog/seed';
import { readProvenance } from '@/lib/provenance';
import { PROMPT_VERSION } from '@/lib/prompts/quality';

const CAT = 'bestiary';
const LORE = 'Lore / Codex';
const pofSeeds = seededEntities(CAT).filter((e) => !e.provenance);
const entity = (i: number) => pofSeeds[i].id;

const post = <T,>(handler: (r: NextRequest) => Promise<T>, url: string, body: unknown) =>
  handler(new NextRequest(`http://localhost${url}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('POST /api/catalog/step-submit — the MCP door stamps the recipe prompt version', () => {
  it('persists engine unknown + the current PROMPT_VERSION; the verdict is unchanged', async () => {
    const e = entity(0);
    const data = { lore: 'The bone-wraith walks the ossuary halls. '.repeat(8) };
    const res = await post(postStepSubmit, '/api/catalog/step-submit', { catalogId: CAT, entityId: e, step: LORE, data });
    const body = await res.json();
    expect(res.status).toBe(200);

    const p = readProvenance(getArtifact(CAT, e, LORE)?.data);
    expect(p?.engine).toBe('unknown');
    expect(p?.promptVersion).toBe(PROMPT_VERSION);

    const expected = gradeArtifact(CAT, LORE, data, e).result;
    expect(body.data.acceptance.status).toBe(expected?.status);
    expect(body.data.acceptance.tier).toBe(expected?.tier);
  });
});

describe('POST /api/pipeline-artifacts — the lab door keeps the headless rules', () => {
  it('refuses an off-profile step with a 404 naming the profile, and writes nothing', async () => {
    const e = entity(1);
    const res = await post(postArtifact, '/api/pipeline-artifacts', {
      catalogId: CAT, entityId: e, step: 'Sprite Render', data: { sprites: {} }, ueAssets: [], status: 'pass',
    });
    expect(res.status).toBe(404);
    expect(String((await res.json()).error)).toMatch(/diablo1/);
    expect(listArtifacts(CAT, e).some((a) => a.step === 'Sprite Render')).toBe(false);
  });

  it('syncs the derived lifecycle after a write', async () => {
    const e = entity(2);
    const res = await post(postArtifact, '/api/pipeline-artifacts', {
      catalogId: CAT, entityId: e, step: LORE, data: { lore: 'x'.repeat(240) }, ueAssets: [], status: 'pass', engine: 'Code',
    });
    expect(res.status).toBe(200);
    expect(getLifecycle(CAT, e)?.lifecycle).toBe(deriveCatalogLifecycle(CAT, e)[0].lifecycle);
  });

  it('[guard] persists the PURE checker verdict and the declared Code engine', async () => {
    const e = entity(3);
    const data = { lore: 'too short' };
    const res = await post(postArtifact, '/api/pipeline-artifacts', {
      catalogId: CAT, entityId: e, step: LORE, data, ueAssets: [], status: 'pass', engine: 'Code',
    });
    expect(res.status).toBe(200);
    const row = getArtifact(CAT, e, LORE);
    const { raw } = gradeArtifact(CAT, LORE, data, e);
    expect(raw?.status).not.toBe('pass');
    expect(row?.status).toBe(raw?.status);
    expect(readProvenance(row?.data)?.engine).toBe('Code');
  });
});

describe('POST /api/pipeline-artifacts/revisions — an ungraded restore says so', () => {
  it('stamps UNGRADED on the restored reason, keeping what the producer reported', async () => {
    const cat = 'loot-filter';
    const ent = 'door-restore';
    const step = 'Filter Rules';
    upsertArtifact({ catalogId: cat, entityId: ent, step, data: { rules: ['v1'] }, ueAssets: [], status: 'pass', tier: 'L0', reason: 'x' });
    upsertArtifact({ catalogId: cat, entityId: ent, step, data: { rules: ['v2'] }, ueAssets: [], status: 'pass', tier: 'L0' });
    const [rev] = listRevisions(cat, ent, step);

    const res = await post(postRevision, '/api/pipeline-artifacts/revisions', { revisionId: rev.id });
    expect(res.status).toBe(200);
    const reason = getArtifact(cat, ent, step)?.reason ?? '';
    expect(reason.startsWith('UNGRADED:')).toBe(true);
    expect(reason).toContain('producer reported: x');
  });
});
