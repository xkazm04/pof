/**
 * POST /api/judge-verdicts + POST /api/craft-verdicts — both write seams answer through ONE
 * admission door per axis (`@/lib/judge/admission`, `@/lib/craft/admission`).
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-verdict-admission-${process.pid}.db`;
});
import { POST as postJudge } from '@/app/api/judge-verdicts/route';
import { POST as postCraft } from '@/app/api/craft-verdicts/route';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { listCraftVerdicts } from '@/lib/craft/craft-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';

function req(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function send(post: (r: NextRequest) => Promise<Response>, url: string, body: unknown) {
  const res = await post(req(url, body));
  return { status: res.status, json: (await res.json()) as { success: boolean; error?: string } };
}

const judge = (body: unknown) => send(postJudge, '/api/judge-verdicts', body);
const craft = (body: unknown) => send(postCraft, '/api/craft-verdicts', body);

const VERDICT = {
  catalogId: 'items', entityId: 'e1', step: 'Concept Brief', judge: 'llm-panel', verdict: 'pass',
  score: 95, findings: 'fifteen plus characters of findings', model: 'm', rubricVersion: RUBRIC_VERSION,
};

describe('POST /api/judge-verdicts — admission', () => {
  it('refuses a PASS under a rubric not in force and stores nothing', async () => {
    const r = await judge({ ...VERDICT, catalogId: 'future-cat', rubricVersion: RUBRIC_VERSION + 1 });
    expect(r.status).toBe(400);
    expect(r.json.error).toContain(`rubric v${RUBRIC_VERSION + 1} is not in force (current v${RUBRIC_VERSION})`);
    expect(listVerdicts('future-cat')).toEqual([]);
  });

  it('refuses a current-rubric panel PASS below the shippable band', async () => {
    const r = await judge({ ...VERDICT, entityId: 'band', score: 85 });
    expect(r.status).toBe(400);
    expect(listVerdicts('items').find((v) => v.entityId === 'band')).toBeUndefined();
  });

  it('[honest floor] admits a FAIL at a pass-band score', async () => {
    expect((await judge({ ...VERDICT, entityId: 'strict', verdict: 'fail', score: 95 })).status).toBe(200);
  });

  it('[guard] admits the batch-inject vlm shape and a human fail 41', async () => {
    const { rubricVersion: _omit, ...noRubric } = VERDICT;
    void _omit;
    expect((await judge({ ...noRubric, entityId: 'vlm', judge: 'vlm', score: 70 })).status).toBe(200);
    expect((await judge({ ...VERDICT, entityId: 'human', judge: 'human', verdict: 'fail', score: 41 })).status).toBe(200);
  });
});

const GAUGE = {
  catalogId: 'items', entityId: 'e1', step: 'Concept Brief', aLevel: 'A3',
  findings: [{ criterion: 'specificity', detail: 'the brief names no concrete mechanic', class: 'content' }],
  model: 'opus-craft-fleet-test',
};

describe('POST /api/craft-verdicts — admission', () => {
  it('refuses a dialog-trees gauge re-labelled under game-systems-code, naming the expected lens', async () => {
    const r = await craft({ ...GAUGE, catalogId: 'dialog-trees', lens: 'game-systems-code', lensVersion: 1 });
    expect(r.status).toBe(400);
    expect(r.json.error).toContain("'dialogue'");
  });

  it('derives lens + lensVersion when the writer omits them', async () => {
    const r = await craft({ ...GAUGE, catalogId: 'dialog-trees' });
    expect(r.status).toBe(200);
    const stored = listCraftVerdicts('dialog-trees').find((v) => v.entityId === 'e1');
    expect(stored?.lens).toBe('dialogue');
    expect(stored?.lensVersion).toBe(LENS_VERSIONS.dialogue);
  });

  it('refuses a lens version above the one in force', async () => {
    const r = await craft({ ...GAUGE, entityId: 'v2', lens: 'game-systems-code', lensVersion: LENS_VERSIONS['game-systems-code'] + 1 });
    expect(r.status).toBe(400);
  });

  it('refuses A3 on a 3D mesh step (roof A2), naming the ceiling and craft-ceilings.json', async () => {
    const r = await craft({ ...GAUGE, step: '3D Mesh' });
    expect(r.status).toBe(400);
    expect(r.json.error).toContain('A2');
    expect(r.json.error).toContain('craft-ceilings.json');
  });

  it('[guard] the existing BASE shape (items::Concept Brief, game-systems-code v1) is admitted', async () => {
    expect((await craft({ ...GAUGE, entityId: 'base', lens: 'game-systems-code', lensVersion: 1 })).status).toBe(200);
  });
});
