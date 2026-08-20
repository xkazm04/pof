/**
 * The critique -> finish -> re-grade loop, end to end, on a REAL failing verdict.
 *
 * Driven by `generated/tripo3d/jinx_p1.glb` as it actually exists on the operator's disk
 * (4,867 faces, 19 connected components, histogram below — measured 2026-08-20 in Node
 * from the glTF buffers; never python, after the 211 GB crash of 2026-08-18). Graded as a
 * `prop` it FAILS the Tier-1 gate on `parts-over-budget`, which is the one defect class in
 * the whole 52-mesh corpus that the retopo/decimate stage can actually resolve.
 *
 * Two edges are stubbed and named, because neither may run here: the trimesh critic (it
 * is the python this repo is forbidden from invoking) and headless Blender (minutes per
 * run). Everything between them — plan, guards, job, re-grade at stage `finished`,
 * before -> after — is the real code path.
 *
 * Corpus-wide reality this pins, and it is not flattering: of the 50 (mesh x asset-class)
 * combinations that FAIL the gate across the corpus, exactly 3 are routable and 47 are
 * refused, every one of them because `mesh-finish` resolves none of their failing
 * criteria. A loop that mostly declines to run is the honest shape of this pipeline.
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreMesh, type MeshMetrics, type CritiqueResult, type CritiqueDeps } from '@/lib/visual-gen/mesh-critique';
import { critiqueThresholdsFor } from '@/lib/visual-gen/polycount-presets';
import { planFinishFromCritique } from '@/lib/visual-gen/finish-routing';
import { startMeshFinishJob, getMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';
import type { MeshFinishResult, MeshFinishSpec } from '@/lib/visual-gen/mesh-finish';

/** generated/tripo3d/jinx_p1.glb — verbatim measurement. */
const JINX_P1: MeshMetrics = {
  verts: 2_465,
  faces: 4_867,
  watertight: false,
  windingConsistent: true,
  components: 19,
  euler: 0,
  bbox: [0.302734, 0.998047, 0.443359],
  volume: null,
  area: 0,
  degenerateFaces: 0,
  componentFaces: [4249, 174, 60, 48, 48, 36, 36, 36, 30, 30, 24, 12, 12, 12, 12, 12, 12, 12, 12],
  componentFacesOmitted: 0,
};

/** What a successful join+decimate would plausibly hand back: one shell, inside budget. */
const FINISHED: MeshMetrics = {
  ...JINX_P1,
  verts: 5_100,
  faces: 9_800,
  components: 1,
  componentFaces: [9_800],
  watertight: true,
  bbox: [0.302734, 0.998047, 0.443359],
};

function cardFor(m: MeshMetrics, assetClass: string): CritiqueResult {
  return { ok: true, metrics: m, ...scoreMesh(m, critiqueThresholdsFor(assetClass)) };
}

function settle(): Promise<void> {
  return new Promise((r) => { setTimeout(r, 0); });
}

describe('critique -> finish -> re-grade, on the real jinx_p1 verdict', () => {
  it('the real mesh really does fail on a finish-resolvable criterion', () => {
    const card = scoreMesh(JINX_P1, critiqueThresholdsFor('prop'));
    expect(card.verdict).toBe('fail');
    const fails = card.findings.filter((f) => f.severity === 'fail').map((f) => f.code);
    expect(fails).toContain('parts-over-budget'); // 11 substantial parts vs the prop budget of 6
  });

  it('runs the loop and reports before -> after honestly', async () => {
    const before = cardFor(JINX_P1, 'prop');
    const plan = planFinishFromCritique({
      meshName: 'jinx_p1.glb', meshDir: 'tripo3d', critique: before,
      assetClass: 'prop', now: 1, cwd: '/repo',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    // The plan states up front what it will NOT fix — jinx_p1 also carries specks.
    expect(plan.addresses).toContain('parts-over-budget');
    expect(plan.unaddressed).toContain('floaters');
    expect(plan.spec.cullInterior).toBeUndefined();

    const runner = vi.fn(async (spec: MeshFinishSpec): Promise<MeshFinishResult> => ({
      ok: true, meshPath: spec.outputPath, facesIn: 4_867, facesOut: 9_800,
      uvUnwrapped: true, sizeMB: 0.4, durationMs: 1_000,
    }));
    // Stands in for the trimesh critic. Asserts the store graded at stage `finished`.
    const critic = vi.fn(async (_p: string, deps?: CritiqueDeps): Promise<CritiqueResult> => {
      expect(deps?.stage).toBe('finished');
      return { ...cardFor(FINISHED, 'prop'), stage: 'finished' };
    });

    const jobId = startMeshFinishJob(plan.spec, 'prop', runner, critic, { before, planNote: plan.note });
    await settle();

    const job = getMeshFinishJob(jobId);
    expect(job?.status).toBe('done');
    expect(job?.beforeCritique?.verdict).toBe('fail');
    expect(job?.remediation?.improved).toBe(true);
    expect(job?.remediation?.summary).toMatch(/resolved: .*parts-over-budget/);
    // The output never leaves the allow-listed dir.
    expect(job?.result?.meshPath).toMatch(/\/generated\/mesh-finish\//);
  });

  it('a finish that RAN but left the mesh failing is reported as not improved', async () => {
    const before = cardFor(JINX_P1, 'prop');
    const plan = planFinishFromCritique({ meshName: 'jinx_p1.glb', meshDir: 'tripo3d', critique: before, assetClass: 'prop', now: 2, cwd: '/repo' });
    if (!plan.ok) throw new Error(plan.reason);

    const runner = async (spec: MeshFinishSpec): Promise<MeshFinishResult> => ({
      ok: true, meshPath: spec.outputPath, facesIn: 4_867, facesOut: 9_800, durationMs: 1,
    });
    // Decimation collapsed the count but left the specks — the measured real behaviour.
    const stillSpecked: MeshMetrics = { ...FINISHED, components: 12, componentFaces: [9_600, 30, 22, 20, 20, 18, 18, 17, 16, 16, 15, 8] };
    const critic = async (): Promise<CritiqueResult> => ({ ...cardFor(stillSpecked, 'prop'), stage: 'finished' });

    const jobId = startMeshFinishJob(plan.spec, 'prop', runner, critic, { before, planNote: plan.note });
    await settle();

    const job = getMeshFinishJob(jobId);
    expect(job?.status).toBe('done');
    expect(job?.remediation?.improved).toBe(false);
    expect(job?.remediation?.after?.verdict).toBe('fail');
  });

  it('a finish whose output could not be graded never claims an improvement', async () => {
    const before = cardFor(JINX_P1, 'prop');
    const plan = planFinishFromCritique({ meshName: 'jinx_p1.glb', meshDir: 'tripo3d', critique: before, assetClass: 'prop', now: 3, cwd: '/repo' });
    if (!plan.ok) throw new Error(plan.reason);

    const runner = async (spec: MeshFinishSpec): Promise<MeshFinishResult> => ({ ok: true, meshPath: spec.outputPath, durationMs: 1 });
    const critic = async (): Promise<CritiqueResult> => ({ ok: false, unavailable: true, error: 'POF_TRIPOSR_ROOT is not set' });

    const jobId = startMeshFinishJob(plan.spec, 'prop', runner, critic, { before, planNote: plan.note });
    await settle();

    const job = getMeshFinishJob(jobId);
    expect(job?.remediation?.improved).toBe(false);
    expect(job?.remediation?.summary).toMatch(/NOT re-graded/);
  });

  it('an unrouted job carries no remediation at all — it is not a remediation run', async () => {
    const runner = async (spec: MeshFinishSpec): Promise<MeshFinishResult> => ({ ok: true, meshPath: spec.outputPath, durationMs: 1 });
    const critic = async (): Promise<CritiqueResult> => cardFor(FINISHED, 'prop');
    const jobId = startMeshFinishJob({ highPolyPath: '/a.glb', outputPath: '/b.glb', targetFaces: 10_000 }, 'prop', runner, critic);
    await settle();
    const job = getMeshFinishJob(jobId);
    expect(job?.remediation).toBeUndefined();
    expect(job?.beforeCritique).toBeUndefined();
  });
});
