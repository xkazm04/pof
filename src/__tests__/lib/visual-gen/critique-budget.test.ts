import { describe, it, expect } from 'vitest';
import { scoreMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';
import { critiqueDepsForSpec } from '@/lib/visual-gen/tripo-job-store';
import type { TripoSpec } from '@/lib/visual-gen/tripo-runner';

const mesh = (faces: number): MeshMetrics => ({
  verts: Math.round(faces / 2),
  faces,
  watertight: true,
  windingConsistent: true,
  components: 1,
  euler: 2,
  bbox: [1, 1, 2],
  volume: 1,
  area: 6,
  degenerateFaces: 0,
});

const spec = (over: Partial<TripoSpec> = {}): TripoSpec =>
  ({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', ...over });

describe('scoreMesh — requested budget vs class ceiling', () => {
  it('makes no budget claim when no budget was supplied', () => {
    const card = scoreMesh(mesh(55_000), { maxFacesWarn: 60_000 });
    expect(card.budget).toBeUndefined();
    expect(card.verdict).toBe('pass');
  });

  it('catches an overrun that sits UNDER the class ceiling', () => {
    // 55k is inside the 60k character ceiling but is 1.4x the 40k that was requested.
    // Before the budget grade this passed clean — the whole point of the check.
    const card = scoreMesh(mesh(55_000), { maxFacesWarn: 60_000 }, { triangleBudget: 40_000, topology: 'triangles' });
    expect(card.verdict).toBe('warn');
    expect(card.budget?.verdict).toBe('over');
    expect(card.reasons.join(' ')).toContain('40000');
  });

  it('passes a delivery that honours its budget', () => {
    const card = scoreMesh(mesh(38_000), { maxFacesWarn: 60_000 }, { triangleBudget: 40_000, topology: 'triangles' });
    expect(card.verdict).toBe('pass');
    expect(card.budget?.verdict).toBe('honored');
  });

  it('keeps the budget grade separate from structural failures', () => {
    const broken: MeshMetrics = { ...mesh(80_000), verts: 3 };
    const card = scoreMesh(broken, { maxFacesWarn: 200_000 }, { triangleBudget: 40_000, topology: 'triangles' });
    expect(card.verdict).toBe('fail');
    expect(card.budget?.verdict).toBe('over');
  });
});

describe('critiqueDepsForSpec — the wiring that was missing', () => {
  it('applies class-aware thresholds instead of the class-blind default', () => {
    // critiqueThresholdsFor had ZERO production call sites before this; every mesh was
    // graded against maxFacesWarn 200_000 regardless of what it was supposed to be.
    const deps = critiqueDepsForSpec(spec({ assetClass: 'character' }));
    expect(deps.thresholds?.maxFacesWarn).toBe(60_000);
    expect(deps.thresholds?.maxComponentsFail).toBe(24);
  });

  it('carries the requested face budget onto the gate', () => {
    const deps = critiqueDepsForSpec(spec({ assetClass: 'character', faceLimit: 40_000 }));
    expect(deps.budget).toEqual({ triangleBudget: 40_000, topology: 'triangles' });
  });

  it('records quad topology so the budget is graded in the right unit', () => {
    const deps = critiqueDepsForSpec(spec({ faceLimit: 20_000, quad: true }));
    expect(deps.budget?.topology).toBe('quads');
  });

  it('supplies no budget when none was requested rather than inventing one', () => {
    expect(critiqueDepsForSpec(spec({ assetClass: 'character' })).budget).toBeUndefined();
  });

  it('falls back to empty thresholds for an unknown or absent class', () => {
    expect(critiqueDepsForSpec(spec()).thresholds).toEqual({});
    expect(critiqueDepsForSpec(spec({ assetClass: 'nope' })).thresholds).toEqual({});
  });

  it('end-to-end: a character delivered at 2x its budget warns through the wired deps', () => {
    const deps = critiqueDepsForSpec(spec({ assetClass: 'character', faceLimit: 40_000 }));
    const card = scoreMesh(mesh(80_000), deps.thresholds, deps.budget);
    expect(card.verdict).toBe('warn');
    expect(card.budget?.ratio).toBeCloseTo(2, 1);
    expect(card.reasons.join(' ')).toMatch(/quad/i);
  });
});
