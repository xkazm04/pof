import { describe, it, expect } from 'vitest';
import {
  POLYCOUNT_PRESETS,
  generationPlanFor,
  polycountFor,
} from '@/lib/visual-gen/polycount-presets';
import { planFinishFromCritique } from '@/lib/visual-gen/finish-routing';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

/**
 * The generation strategy is the CODE half of a rule PoF already ships as knowledge:
 * `ai-lowpoly-generation-not-final` states direct low-poly generation is acceptable
 * "only for SMALL simple props", and that anything bake-quality must be generated
 * high-poly and then retopologized + baked. Until now every class was budgeted at the
 * generator regardless, so the two halves disagreed.
 */
describe('generationPlanFor', () => {
  it('budgets small simple classes at the generator', () => {
    for (const cls of ['prop', 'weapon', 'modular-part'] as const) {
      const plan = generationPlanFor(cls);
      expect(plan?.strategy).toBe('budgeted');
      expect(plan?.faceLimit).toBe(polycountFor(cls)!.faceLimit);
      expect(plan?.finishTargetFaces).toBe(polycountFor(cls)!.faceLimit);
    }
  });

  it('defers the budget for the bake-quality classes and hands the generator nothing', () => {
    for (const cls of ['character', 'environment'] as const) {
      const plan = generationPlanFor(cls);
      expect(plan?.strategy).toBe('max-then-finish');
      expect(plan?.faceLimit).toBeUndefined();
      expect(plan?.finishTargetFaces).toBe(polycountFor(cls)!.faceLimit);
    }
  });

  it('never invents a plan for an unknown class', () => {
    expect(generationPlanFor('spaceship')).toBeUndefined();
    expect(generationPlanFor('')).toBeUndefined();
  });

  it('every preset declares a strategy, so a new class cannot default in silently', () => {
    for (const p of POLYCOUNT_PRESETS) {
      expect(['budgeted', 'max-then-finish']).toContain(p.generation);
    }
  });
});

function critique(verdict: 'pass' | 'warn' | 'fail', faces: number): CritiqueResult {
  return {
    ok: true,
    verdict,
    score: verdict === 'fail' ? 40 : 85,
    metrics: {
      verts: faces * 2, faces, watertight: true, windingConsistent: true,
      components: 3, euler: 2, bbox: [1, 1, 1], volume: 1, area: 1, degenerateFaces: 0,
    },
    findings: verdict === 'fail'
      ? [{ code: 'face-count', severity: 'fail', reason: 'over budget' }]
      : [{ code: 'face-count', severity: 'warn', reason: 'over budget' }],
  } as CritiqueResult;
}

describe('planFinishFromCritique — deferred-budget routing', () => {
  const base = { meshName: 'house.glb', meshDir: 'meshes', stage: 'raw' as const, now: 1, cwd: '/x' };

  it('routes an over-budget max-then-finish mesh even though its verdict is only a warn', () => {
    const plan = planFinishFromCritique({ ...base, critique: critique('warn', 1_800_000), assetClass: 'environment' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.spec.targetFaces).toBe(60_000);
    expect(plan.addresses).toEqual(['face-count']);
    expect(plan.note).toMatch(/deferred/i);
  });

  it('still refuses a warn on a budgeted class — nothing deferred the budget there', () => {
    const plan = planFinishFromCritique({ ...base, critique: critique('warn', 1_800_000), assetClass: 'prop' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/not a failure/);
  });

  it('refuses when the unbudgeted generation already landed inside its class budget', () => {
    const plan = planFinishFromCritique({ ...base, critique: critique('pass', 41_000), assetClass: 'environment' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/inside the 60000-face environment budget/);
  });

  it('refuses when nothing counted the faces, rather than routing on the strategy alone', () => {
    const c = { ok: true, verdict: 'warn', score: 85, findings: [] } as unknown as CritiqueResult;
    const plan = planFinishFromCritique({ ...base, critique: c, assetClass: 'environment' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/never face-counted/);
  });
});
