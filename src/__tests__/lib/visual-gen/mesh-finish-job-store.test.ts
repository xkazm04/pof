import { describe, it, expect, vi } from 'vitest';
import {
  startMeshFinishJob,
  getMeshFinishJob,
  critiqueDepsForFinish,
} from '@/lib/visual-gen/mesh-finish-job-store';
import type { MeshFinishSpec, MeshFinishResult } from '@/lib/visual-gen/mesh-finish';
import type { CritiqueDeps, CritiqueResult } from '@/lib/visual-gen/mesh-critique';

const SPEC: MeshFinishSpec = {
  highPolyPath: 'in.glb',
  outputPath: 'out.glb',
  targetFaces: 40_000,
  unwrap: true,
};

const okResult = (over: Partial<MeshFinishResult> = {}): MeshFinishResult => ({
  ok: true,
  meshPath: 'out.glb',
  facesIn: 1_492_072,
  facesOut: 40_000,
  durationMs: 5,
  ...over,
});

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('critiqueDepsForFinish', () => {
  it('uses targetFaces as the budget the finished mesh is held to', () => {
    const deps = critiqueDepsForFinish(SPEC, 'character');
    expect(deps.budget).toEqual({ triangleBudget: 40_000, topology: 'triangles' });
    expect(deps.thresholds?.maxFacesWarn).toBe(60_000);
  });

  it('invents no budget when the run skipped retopo entirely', () => {
    const deps = critiqueDepsForFinish({ ...SPEC, targetFaces: undefined }, 'character');
    expect(deps.budget).toBeUndefined();
  });

  it('falls back to empty thresholds without an asset class', () => {
    expect(critiqueDepsForFinish(SPEC).thresholds).toEqual({});
  });
});

describe('startMeshFinishJob', () => {
  it('returns an id immediately and resolves to done', async () => {
    const id = startMeshFinishJob(SPEC, 'character', async () => okResult(), async () => ({ ok: true } as CritiqueResult));
    expect(getMeshFinishJob(id)?.status).toBe('running');
    await settle();
    const job = getMeshFinishJob(id);
    expect(job?.status).toBe('done');
    expect(job?.result?.facesOut).toBe(40_000);
  });

  it('grades the finished low-poly against its own target budget', async () => {
    const critic = vi.fn<(p: string, d?: CritiqueDeps) => Promise<CritiqueResult>>(
      async () => ({ ok: true } as CritiqueResult),
    );
    const id = startMeshFinishJob(SPEC, 'character', async () => okResult(), critic);
    await settle();
    expect(critic).toHaveBeenCalledOnce();
    const [meshPath, deps] = critic.mock.calls[0]!;
    expect(meshPath).toBe('out.glb');
    expect(deps?.budget).toEqual({ triangleBudget: 40_000, topology: 'triangles' });
    expect(getMeshFinishJob(id)?.critique?.ok).toBe(true);
  });

  it('records a runner failure with its reason and does not critique', async () => {
    const critic = vi.fn(async () => ({ ok: true } as CritiqueResult));
    const id = startMeshFinishJob(SPEC, undefined, async () => ({ ok: false, error: 'Blender not found', durationMs: 1 }), critic);
    await settle();
    const job = getMeshFinishJob(id);
    expect(job?.status).toBe('error');
    expect(job?.error).toMatch(/Blender not found/);
    expect(critic).not.toHaveBeenCalled();
  });

  it('keeps a successful finish when the critique throws — the gate is best-effort', async () => {
    const id = startMeshFinishJob(SPEC, 'character', async () => okResult(), async () => { throw new Error('trimesh venv missing'); });
    await settle();
    const job = getMeshFinishJob(id);
    expect(job?.status).toBe('done');
    expect(job?.critique).toBeUndefined();
  });

  it('surfaces a thrown runner as an error rather than a hung job', async () => {
    const id = startMeshFinishJob(SPEC, undefined, async () => { throw new Error('spawn EPERM'); });
    await settle();
    expect(getMeshFinishJob(id)?.status).toBe('error');
    expect(getMeshFinishJob(id)?.error).toMatch(/EPERM/);
  });

  it('preserves the unwrap-skipped reason on the job result', async () => {
    const id = startMeshFinishJob(
      { ...SPEC, targetFaces: undefined },
      undefined,
      async () => okResult({ facesOut: undefined, unwrapSkippedReason: 'unwrap runs on the retopo’d low-poly only' }),
      async () => ({ ok: true } as CritiqueResult),
    );
    await settle();
    expect(getMeshFinishJob(id)?.result?.unwrapSkippedReason).toMatch(/low-poly only/);
  });

  it('returns undefined for an unknown job id', () => {
    expect(getMeshFinishJob('nope')).toBeUndefined();
  });
});
