import { describe, it, expect } from 'vitest';
import {
  TEXEL_DENSITY_UNIT,
  DEFAULT_TARGET_PX_PER_M,
  MAX_BAKE_SIZE,
  MIN_BAKE_SIZE,
  texelDensity,
  bakeSizeForExtent,
  gradeTexelDensity,
  planKitAtlas,
  type KitMember,
} from '@/lib/visual-gen/texel-density';

describe('texel density unit', () => {
  it('declares px/m as the authored unit', () => {
    expect(TEXEL_DENSITY_UNIT).toBe('px/m');
  });

  it('is bake pixels across the longest real-world extent', () => {
    expect(texelDensity(1024, 1)).toBe(1024);
    expect(texelDensity(1024, 2)).toBe(512);
    expect(texelDensity(2048, 0.5)).toBe(4096);
  });

  it('returns undefined rather than a number for an unmeasured extent', () => {
    expect(texelDensity(1024, 0)).toBeUndefined();
    expect(texelDensity(1024, Number.NaN)).toBeUndefined();
    expect(texelDensity(0, 1)).toBeUndefined();
  });
});

describe('bake size for a real-world extent', () => {
  it('picks the ladder rung that meets the target density', () => {
    // 1 m prop at 1024 px/m needs 1024 px.
    expect(bakeSizeForExtent(1, 1024)).toBe(1024);
    // 2 m prop at 1024 px/m needs 2048 px.
    expect(bakeSizeForExtent(2, 1024)).toBe(2048);
  });

  it('rounds UP to a power of two so the target is met, never missed', () => {
    // 1.5 m at 1024 px/m needs 1536 px -> 2048, not 1024.
    expect(bakeSizeForExtent(1.5, 1024)).toBe(2048);
  });

  it('clamps to the ladder ends', () => {
    expect(bakeSizeForExtent(0.01, 1024)).toBe(MIN_BAKE_SIZE);
    expect(bakeSizeForExtent(100, 1024)).toBe(MAX_BAKE_SIZE);
  });

  it('defaults the target to the project default', () => {
    expect(bakeSizeForExtent(1)).toBe(bakeSizeForExtent(1, DEFAULT_TARGET_PX_PER_M));
  });
});

describe('grading a bake against the size it covers', () => {
  it('passes the generator-normalised 1 m prop at the 1024 default', () => {
    const g = gradeTexelDensity({ bakeSize: 1024, extentM: 1 });
    expect(g.verdict).toBe('matches');
    expect(g.densityPxPerM).toBe(1024);
  });

  it('catches a big surface starved by a fixed bake size', () => {
    // The gotcha PoF already documents in prose ("even an 8K bake goes blurry"),
    // now measured: a 12 m cave chunk at the hardcoded 1024 default.
    const g = gradeTexelDensity({ bakeSize: 1024, extentM: 12 });
    expect(g.verdict).toBe('starved');
    expect(Math.round(g.densityPxPerM!)).toBe(85);
    expect(g.recommendedBakeSize).toBe(MAX_BAKE_SIZE);
    expect(g.reason).toMatch(/starv|blur|below/i);
  });

  it('names the shortfall factor so the caller can act on it', () => {
    const g = gradeTexelDensity({ bakeSize: 1024, extentM: 4 });
    expect(g.verdict).toBe('starved');
    expect(g.ratio).toBeCloseTo(0.25, 5);
  });

  it('catches a small prop wasting a bake it cannot show', () => {
    // A 10 cm coin at 1024 px is 10240 px/m — 10x the target, all of it invisible.
    const g = gradeTexelDensity({ bakeSize: 1024, extentM: 0.1 });
    expect(g.verdict).toBe('wasted');
    expect(g.recommendedBakeSize).toBe(MIN_BAKE_SIZE);
  });

  it('reports unmeasured — never matches — when the size is unknown', () => {
    const g = gradeTexelDensity({ bakeSize: 1024, extentM: undefined });
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toBeTruthy();
  });

  it('reports unmeasured when nothing was baked', () => {
    expect(gradeTexelDensity({ bakeSize: undefined, extentM: 1 }).verdict).toBe('unmeasured');
  });
});

describe('kit atlas planning', () => {
  const kit = (...m: Array<[string, number]>): KitMember[] =>
    m.map(([name, extentM]) => ({ name, extentM }));

  it('gives every member the cell its real size earns', () => {
    const plan = planKitAtlas(kit(['crate', 1], ['barrel', 1], ['coin', 0.1], ['plank', 2]));
    expect(plan.ok).toBe(true);
    const byName = Object.fromEntries(plan.members!.map((m) => [m.name, m.cellPx]));
    expect(byName.crate).toBe(1024);
    expect(byName.plank).toBe(2048);
    expect(byName.coin).toBe(MIN_BAKE_SIZE);
  });

  it('sizes the atlas to hold every cell, and never below the largest cell', () => {
    const plan = planKitAtlas(kit(['plank', 2], ['coin', 0.1]));
    expect(plan.atlasSize!).toBeGreaterThanOrEqual(2048);
    const area = plan.members!.reduce((s, m) => s + m.cellPx * m.cellPx, 0);
    expect(plan.atlasSize! * plan.atlasSize!).toBeGreaterThanOrEqual(area);
  });

  it('reports the draw-call saving that is the whole point of an atlas', () => {
    const plan = planKitAtlas(kit(['a', 1], ['b', 1], ['c', 1]));
    expect(plan.materialsBefore).toBe(3);
    expect(plan.materialsAfter).toBe(1);
  });

  it('degrades density honestly rather than inventing an oversized atlas', () => {
    // Four 4 m rocks each want 4096 -> 8192 atlas, past the ceiling.
    const plan = planKitAtlas(kit(['r1', 4], ['r2', 4], ['r3', 4], ['r4', 4]));
    expect(plan.ok).toBe(true);
    expect(plan.atlasSize).toBe(MAX_BAKE_SIZE);
    expect(plan.verdict).toBe('starved');
    expect(plan.achievedPxPerM!).toBeLessThan(DEFAULT_TARGET_PX_PER_M);
    expect(plan.reason).toMatch(/ceiling|reduc|starv/i);
  });

  it('refuses an empty kit instead of planning an empty atlas', () => {
    const plan = planKitAtlas([]);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBeTruthy();
  });

  it('refuses a kit whose members were never measured', () => {
    const plan = planKitAtlas(kit(['ghost', 0]));
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/measur|extent/i);
  });
});
