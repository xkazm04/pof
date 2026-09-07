/**
 * The seam that gives `importGlbToUE` a caller.
 *
 * `ue-import.ts` was built, tested and then sat with ZERO production consumers — the same
 * shape `mesh-finish-job-store.ts` was written to fix for `runMeshFinish`. This store is
 * that seam, and it adds the thing a route could not do by hand: the collision plan is
 * DERIVED from the mesh's own measured shell count instead of being asserted by the caller.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  collisionPlanFor,
  startUeImportJob,
  getUeImportJob,
  type UeImportJobSpec,
} from '@/lib/visual-gen/ue-import-job-store';
import type { CritiqueResult, MeshMetrics } from '@/lib/visual-gen/mesh-critique';
import type { UeImportResult } from '@/lib/visual-gen/ue-import';

const metrics = (over: Partial<MeshMetrics> = {}): MeshMetrics => ({
  verts: 1000, faces: 2000, watertight: true, windingConsistent: true,
  components: 1, euler: 2, bbox: [1, 1, 1], volume: 1, area: 6, degenerateFaces: 0,
  ...over,
});

const critique = (over: Partial<CritiqueResult> = {}): CritiqueResult =>
  ({ ok: true, metrics: metrics(), ...over }) as CritiqueResult;

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('collisionPlanFor — the plan is derived, and says what from', () => {
  it('measures real PARTS from the histogram, not the raw component count', () => {
    // 40 specks + 3 real parts. A raw `components: 43` would reason about concavity that
    // is actually shrapnel; `classifyComponents` separates them.
    const c = critique({
      metrics: metrics({ components: 43, componentFaces: [900, 800, 700, ...Array(40).fill(2)] }),
    });
    const { plan, basis, shells } = collisionPlanFor(c, 'blocking');
    expect(basis).toBe('measured');
    expect(shells).toBe(3);
    expect(plan.kind).toBe('convex');
  });

  it('a measured single-shell mesh gets the box, not hulls', () => {
    const c = critique({ metrics: metrics({ components: 1, componentFaces: [2000] }) });
    const { plan, basis, shells } = collisionPlanFor(c, 'blocking');
    expect(basis).toBe('measured');
    expect(shells).toBe(1);
    expect(plan.kind).toBe('simple');
  });

  it('falls back to a DECLARED shell count when the critic could not run', () => {
    const c: CritiqueResult = { ok: false, unavailable: true, error: 'no trimesh' };
    const { plan, basis, shells } = collisionPlanFor(c, 'blocking', 5);
    expect(basis).toBe('declared');
    expect(shells).toBe(5);
    expect(plan.kind).toBe('convex');
  });

  it('marks an unmeasured, undeclared plan ASSUMED — never silently "measured"', () => {
    const c: CritiqueResult = { ok: false, unavailable: true, error: 'no trimesh' };
    const { basis, plan } = collisionPlanFor(c, 'blocking');
    expect(basis).toBe('assumed');
    // The reason line must carry the doubt, since the kind alone cannot.
    expect(plan.reason).toMatch(/assum|not measured|unmeasured/i);
  });

  it('a decorative asset needs no measurement at all — none is none', () => {
    const c: CritiqueResult = { ok: false, unavailable: true, error: 'no trimesh' };
    const { plan, basis } = collisionPlanFor(c, 'decorative');
    expect(plan.kind).toBe('none');
    expect(basis).toBe('not-needed');
  });

  it('an unmeasured histogram (older critique script) is not read as one shell', () => {
    // `componentFaces` absent means "not measured", which must not become parts: 1.
    const c = critique({ metrics: metrics({ components: 7, componentFaces: undefined }) });
    const { basis, shells } = collisionPlanFor(c, 'blocking');
    expect(basis).toBe('measured');
    expect(shells).toBe(7); // falls back to the raw count, which IS measured
  });
});

describe('startUeImportJob', () => {
  const spec: UeImportJobSpec = { glbPath: 'C:/gen/chair.glb', use: 'blocking', assetName: 'Chair' };

  it('critiques the mesh, plans collision from it, and imports with that plan', async () => {
    const importer = vi.fn(async (): Promise<UeImportResult> => ({
      ok: true, assetPath: '/Game/Generated/Chair.Chair', collisionElements: 6, logs: [],
    }));
    const critic = vi.fn(async () =>
      critique({ metrics: metrics({ components: 4, componentFaces: [900, 800, 700, 600] }) }),
    );
    const id = startUeImportJob(spec, { critic, importer });
    await settle();
    const job = getUeImportJob(id)!;
    expect(job.status).toBe('done');
    expect(job.plan?.kind).toBe('convex');
    expect(job.planBasis).toBe('measured');
    expect(job.result?.collisionElements).toBe(6);
    // The plan the critique produced is the plan that was imported with.
    expect(importer).toHaveBeenCalledWith(spec.glbPath, expect.objectContaining({ collision: job.plan }));
  });

  it('records the job as error when the import refuses to claim collision', async () => {
    const importer = vi.fn(async (): Promise<UeImportResult> => ({
      ok: false, assetPath: '/Game/Generated/Chair.Chair', collisionElements: 0,
      error: 'body_setup holds 0 elements', logs: [],
    }));
    const id = startUeImportJob(spec, { critic: async () => critique(), importer });
    await settle();
    const job = getUeImportJob(id)!;
    expect(job.status).toBe('error');
    expect(job.error).toMatch(/0 elements/);
    // The failed result is still surfaced — an error is not an empty job.
    expect(job.result?.collisionElements).toBe(0);
  });

  it('imports anyway when the critic is unavailable, and says the plan was assumed', async () => {
    const importer = vi.fn(async (): Promise<UeImportResult> => ({
      ok: true, assetPath: '/Game/x.x', collisionElements: 1, logs: [],
    }));
    const id = startUeImportJob(spec, {
      critic: async () => ({ ok: false, unavailable: true, error: 'no trimesh' }),
      importer,
    });
    await settle();
    const job = getUeImportJob(id)!;
    expect(job.status).toBe('done');
    expect(job.planBasis).toBe('assumed');
    expect(job.critique?.unavailable).toBe(true);
  });

  it('a thrown critic does not abort the import — collision is assumed and said so', async () => {
    const importer = vi.fn(async (): Promise<UeImportResult> => ({
      ok: true, assetPath: '/Game/x.x', collisionElements: 1, logs: [],
    }));
    const id = startUeImportJob(spec, {
      critic: async () => { throw new Error('boom'); },
      importer,
    });
    await settle();
    const job = getUeImportJob(id)!;
    expect(job.status).toBe('done');
    expect(job.planBasis).toBe('assumed');
  });

  it('a thrown importer becomes an error job, never a silent success', async () => {
    const id = startUeImportJob(spec, {
      critic: async () => critique(),
      importer: async () => { throw new Error('editor never launched'); },
    });
    await settle();
    const job = getUeImportJob(id)!;
    expect(job.status).toBe('error');
    expect(job.error).toMatch(/editor never launched/);
  });

  it('is running before it settles, and each job gets its own id', async () => {
    const slow = () => new Promise<UeImportResult>((r) => setTimeout(() => r({ ok: true, assetPath: '/Game/a.a', collisionElements: 1, logs: [] }), 20));
    const a = startUeImportJob(spec, { critic: async () => critique(), importer: slow });
    const b = startUeImportJob(spec, { critic: async () => critique(), importer: slow });
    expect(a).not.toBe(b);
    expect(getUeImportJob(a)!.status).toBe('running');
    expect(getUeImportJob(b)!.status).toBe('running');
  });

  it('an unknown id is undefined, not an empty job', () => {
    expect(getUeImportJob('nope')).toBeUndefined();
  });
});
