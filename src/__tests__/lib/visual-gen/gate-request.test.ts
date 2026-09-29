/**
 * One Tier-1 gate request: the four job-store gate builders derive from ONE rule, and the
 * orientation check that `scoreMesh` has always accepted finally reaches a production verdict.
 *
 * Before this, `CritiqueDeps` had no `orientation` slot and `critiqueMesh` never passed the
 * 5th `scoreMesh` argument, so `orientation-lying` could not fire on any job verdict while
 * the asset viewer graded the same bbox `lying`. It lands as a WARN (-15, always with a
 * reason) — nothing that decides re-roll / finish / remediation reads warns.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { gateRequestFor } from '@/lib/visual-gen/gate-request';
import { critiqueMesh, scoreMesh, type CritiqueResult, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';
import { localCritiqueDeps } from '@/lib/visual-gen/polycount-presets';
import { critiqueDepsForSpec } from '@/lib/visual-gen/tripo-job-store';
import { critiqueDepsForFinish, startMeshFinishJob, getMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';
import { trellisGateDeps } from '@/lib/visual-gen/trellis-job-store';
import type { MeshFinishSpec, MeshFinishResult } from '@/lib/visual-gen/mesh-finish';
import { GET as finishStatus } from '@/app/api/visual-gen/mesh-finish/status/route';

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

const healthyStdout = (bbox: string) => [
  'POF_CRITIQUE_VERTS=5000', 'POF_CRITIQUE_FACES=9000', 'POF_CRITIQUE_WATERTIGHT=1',
  'POF_CRITIQUE_WINDING_CONSISTENT=1', 'POF_CRITIQUE_COMPONENTS=1', 'POF_CRITIQUE_EULER=2',
  `POF_CRITIQUE_BBOX=${bbox}`, 'POF_CRITIQUE_VOLUME=1', 'POF_CRITIQUE_AREA=6',
  'POF_CRITIQUE_DEGENERATE_FACES=0', 'POF_CRITIQUE_DONE=1',
].join('\n');

const metrics = (bbox: [number, number, number]): MeshMetrics => ({
  verts: 5000, faces: 9000, watertight: true, windingConsistent: true, components: 1,
  euler: 2, bbox, volume: 1, area: 6, degenerateFaces: 0,
});

const finishSpec: MeshFinishSpec = { highPolyPath: 'h.glb', outputPath: 'o.glb' };
const finishOk = async (): Promise<MeshFinishResult> => ({ ok: true, meshPath: 'm.glb', durationMs: 1 });
const passCritic = async () => ({ ok: true, verdict: 'pass', score: 100 } as CritiqueResult);

describe('gateRequestFor — one rule for what a mesh is held to', () => {
  it('a raw character is held to standing, the Mannequin height, no invented budget', () => {
    const { deps, gradedAs } = gateRequestFor({ assetClass: 'character', stage: 'raw' });
    expect(deps.orientation).toEqual({ expectUpright: true });
    expect(deps.size).toEqual({ targetExtentM: 1.8 });
    expect(deps.stage).toBe('raw');
    expect(deps.budget).toBeUndefined();
    expect(gradedAs).toMatch(/Character \(hero\/NPC\) budget/);
  });

  it('a finished prop carries the budget it was sent, no size, no orientation claim', () => {
    const sent = { triangleBudget: 10_000, topology: 'triangles' as const };
    const { deps } = gateRequestFor({ assetClass: 'prop', stage: 'finished', sentBudget: sent });
    expect(deps.orientation).toBeUndefined();
    expect(deps.size).toBeUndefined();
    expect(deps.budget).toEqual(sent);
    expect(deps.stage).toBe('finished');
    expect(deps.thresholds).toEqual({ maxFacesWarn: 15_000, maxComponentsFail: 6 });
  });
});

describe('critiqueMesh forwards the orientation request', () => {
  it('a lying character reaches the job verdict as an orientation-lying WARN with a reason', async () => {
    const res = await critiqueMesh('x.glb', {
      ...gateRequestFor({ assetClass: 'character', stage: 'raw' }).deps,
      triposrRoot: 'r',
      fileExists: () => true,
      run: async () => ({ stdout: healthyStdout('1.0,0.5,0.5'), code: 0 }),
    });
    expect(res.orientation?.verdict).toBe('lying');
    const finding = res.findings?.find((f) => f.code === 'orientation-lying');
    expect(finding).toMatchObject({ code: 'orientation-lying', severity: 'warn' });
    expect(finding?.reason).toBeTruthy();
    // A warn, never a fail: nothing that buys a re-roll or routes a finish sees it.
    expect(res.verdict).not.toBe('fail');
  });
});

describe('every job-store builder carries the same orientation request', () => {
  it('character -> { expectUpright: true } from all four builders', () => {
    const want = { expectUpright: true };
    expect(localCritiqueDeps('character').deps.orientation).toEqual(want);
    expect(critiqueDepsForSpec({ mode: 'text-to-3d', prompt: 'p', outputPath: 'o.glb', assetClass: 'character' }).orientation).toEqual(want);
    expect(critiqueDepsForFinish({ highPolyPath: 'h.glb', outputPath: 'o.glb' }, 'character').orientation).toEqual(want);
    expect(trellisGateDeps('character', undefined, undefined).deps.orientation).toEqual(want);
  });
});

describe('a finished mesh says what it was held to', () => {
  it('the finish job records gradedAs and the status route projects it', async () => {
    const id = startMeshFinishJob(finishSpec, 'character', finishOk, passCritic);
    await settle();
    const job = getMeshFinishJob(id);
    expect(job?.gradedAs).toMatch(/Character \(hero\/NPC\) budget/);

    const res = await finishStatus(new NextRequest(`http://localhost:3001/api/visual-gen/mesh-finish/status?jobId=${id}`));
    const body = (await res.json()) as { success: boolean; data: { gradedAs?: string } };
    expect(body.success).toBe(true);
    expect(body.data.gradedAs).toBe(job?.gradedAs);
  });

  it('an unrecognised class is stated, not graded class-blind in silence', async () => {
    const id = startMeshFinishJob(finishSpec, 'Character', finishOk, passCritic);
    await settle();
    expect(getMeshFinishJob(id)?.gradedAs).toMatch(/unrecognised assetClass "Character"/);
  });
});

describe('[guard] what stays exactly as it was', () => {
  it('a sent budget is carried in its own unit; a budget-blind provider is never handed one', () => {
    expect(critiqueDepsForSpec({ mode: 'text-to-3d', prompt: 'p', outputPath: 'o.glb', assetClass: 'weapon', faceLimit: 20_000, quad: true }).budget)
      .toEqual({ triangleBudget: 20_000, topology: 'quads' });
    expect(localCritiqueDeps('prop').deps.budget).toBeUndefined();
  });

  it('a prop lying flat is never held to standing', () => {
    const m = metrics([1.0, 0.2, 0.3]);
    const { deps } = gateRequestFor({ assetClass: 'prop', stage: 'raw' });
    const graded = scoreMesh(m, deps.thresholds, deps.budget, deps.size, deps.orientation);
    const today = scoreMesh(m, deps.thresholds, deps.budget, deps.size);
    expect(graded.findings.some((f) => f.code === 'orientation-lying')).toBe(false);
    expect(graded.verdict).toBe(today.verdict);
    expect(graded.score).toBe(today.score);
  });
});
