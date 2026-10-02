/**
 * /api/judge-calibration — the calibration bench's write door and the read `judge-run --calibrate`
 * consumes. A label binds to the content on record (`currentStepBinding`) and the rubric in force;
 * labels live in their own table and never reach grading.
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-judge-calibration-${process.pid}.db`;
});
import { GET, POST } from '@/app/api/judge-calibration/route';
import { listCalibrationLabels } from '@/lib/judge/calibration-labels-db';
import { calibrationTargetsFromResponse } from '@/lib/judge/calibrationLabels';
import { buildCalibrationRun, calibrationKey, evaluateCalibration, latestCalibrationRun } from '@/lib/judge/calibration';
import { stepContentHash } from '@/lib/judge/contentHash';
import { currentStepBinding } from '@/lib/judge/stepBinding';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { upsertArtifact, listArtifactVerdicts } from '@/lib/pipeline-artifacts-db';
import { listVerdicts, upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { deriveCell, getStepFact } from '@/lib/status/statusModel';

const DATA = { glbUrl: '/api/asset/items/item-1/sword.glb', note: 'iron longsword' };
upsertArtifact({ catalogId: 'items', entityId: 'item-1', step: '3D Mesh', data: DATA, ueAssets: [], status: 'pass', tier: 'L1' });
upsertVerdict({
  catalogId: 'items', entityId: 'item-1', step: '3D Mesh', judge: 'vlm', verdict: 'fail', score: 61,
  findings: 'basic topology, placeholder surface', model: 'qwen3-vl-4b', rubricVersion: RUBRIC_VERSION,
});

const dirs: string[] = [];
afterEach(() => {
  delete process.env.POF_JUDGE_CALIBRATION_PATH;
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});
function missingHistory(): string {
  const d = mkdtempSync(join(tmpdir(), 'pof-jcal-'));
  dirs.push(d);
  return join(d, 'never-written.jsonl');
}

async function post(body: unknown) {
  const res = await POST(new NextRequest('http://localhost/api/judge-calibration', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: res.status, json: (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string } };
}
async function get(query = '') {
  const res = await GET(new NextRequest(`http://localhost/api/judge-calibration${query}`));
  return (await res.json()) as { success: boolean; data: Record<string, unknown> };
}

const ITEM_MESH = { catalogId: 'items', entityId: 'item-1', step: '3D Mesh' };

describe('POST /api/judge-calibration — a label binds to the content on record', () => {
  it('stamps the stored label with the artifact content hash and the rubric in force', async () => {
    const r = await post({ ...ITEM_MESH, label: 'placeholder' });
    expect(r.status).toBe(200);
    const stored = listCalibrationLabels().find((l) => calibrationKey(l) === 'items::item-1::3D Mesh')!;
    expect(stored.label).toBe('placeholder');
    expect(stored.contentHash).toBe(stepContentHash(DATA));
    expect(stored.contentHash).toBe(currentStepBinding('items', 'item-1', '3D Mesh')!.contentHash);
    expect(stored.rubricVersion).toBe(RUBRIC_VERSION);
  });

  it('refuses a label for a step with no artifact on record and stores nothing', async () => {
    const before = listCalibrationLabels().length;
    const r = await post({ catalogId: 'characters', entityId: 'character-1', step: '3D Mesh', label: 'fail' });
    expect(r.status).toBe(400);
    expect(r.json.error).toContain('a calibration label must bind to content on record');
    expect(listCalibrationLabels()).toHaveLength(before);
  });

  it('refuses a label when the content changed since the operator opened it', async () => {
    const r = await post({ ...ITEM_MESH, label: 'fail', contentHash: 'v2-0-stale' });
    expect(r.status).toBe(409);
    expect(listCalibrationLabels().find((l) => l.entityId === 'item-1')!.label).toBe('placeholder');
  });
});

describe('GET /api/judge-calibration — the set --calibrate measures against', () => {
  it('returns targets, excluded, progress and the standing evaluateCalibration derives', async () => {
    const path = missingHistory();
    process.env.POF_JUDGE_CALIBRATION_PATH = path;
    const j = await get();
    expect(j.success).toBe(true);
    expect(j.data).toMatchObject({ targets: expect.any(Array), excluded: expect.any(Array), progress: expect.any(Object) });
    expect(j.data.standing).toBe('unrun');
    expect(j.data.standing).toBe(evaluateCalibration(latestCalibrationRun(path), RUBRIC_VERSION).standing);
  });

  it('what the route serves is what judge-run parses: the stored label confirms one target', async () => {
    process.env.POF_JUDGE_CALIBRATION_PATH = missingHistory();
    const parsed = calibrationTargetsFromResponse(await get());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.targets.find((t) => calibrationKey(t) === 'items::item-1::3D Mesh')).toMatchObject({ provisional: false, label: 'placeholder' });
    const run = buildCalibrationRun({ targets: parsed.data.targets, scores: {}, rubricVersion: RUBRIC_VERSION, model: 'm', effort: 'high', spend: { costUsd: 0, spawns: 0, unknownCost: 0 } });
    expect(run.confirmed.total).toBe(1);
  });

  it('a cell read hides the judge band until the operator has labelled it', async () => {
    process.env.POF_JUDGE_CALIBRATION_PATH = missingHistory();
    const j = await get('?catalogId=items&entityId=item-2&step=3D%20Mesh');
    expect(j.data.cell).toMatchObject({ label: null, judge: null });
  });
});

describe('[guard] labels never reach grading', () => {
  it('a shippable label leaves judge_verdicts and the derived cell unchanged', async () => {
    const cell = () => deriveCell('3D Mesh', 'Tripo',
      listArtifactVerdicts('items').filter((a) => a.step === '3D Mesh'), getStepFact('items', '3D Mesh'),
      listVerdicts('items').filter((v) => v.step === '3D Mesh'));
    const verdictsBefore = JSON.stringify(listVerdicts());
    const cellBefore = JSON.stringify(cell());
    expect((await post({ ...ITEM_MESH, label: 'shippable' })).status).toBe(200);
    expect(JSON.stringify(listVerdicts())).toBe(verdictsBefore);
    expect(JSON.stringify(cell())).toBe(cellBefore);
  });
});
