import { describe, it, expect } from 'vitest';
import {
  POLYCOUNT_PRESETS,
  ASSET_CLASS_IDS,
  polycountFor,
  critiqueThresholdsFor,
  planPartBudget,
} from '@/lib/visual-gen/polycount-presets';
import { scoreMesh, type MeshMetrics } from '@/lib/visual-gen/mesh-critique';

const cleanMesh = (faces: number): MeshMetrics => ({
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

describe('POLYCOUNT_PRESETS', () => {
  it('covers the core asset classes with unique ids and sane budgets', () => {
    expect(ASSET_CLASS_IDS).toEqual(
      expect.arrayContaining(['character', 'weapon', 'prop', 'environment', 'modular-part']),
    );
    expect(new Set(ASSET_CLASS_IDS).size).toBe(ASSET_CLASS_IDS.length);
    for (const p of POLYCOUNT_PRESETS) {
      expect(p.faceLimit, `faceLimit for ${p.assetClass}`).toBeGreaterThan(0);
      expect(p.warnAbove, `warnAbove for ${p.assetClass}`).toBeGreaterThan(p.faceLimit);
      expect(p.rationale, `rationale for ${p.assetClass}`).toBeTruthy();
    }
  });

  it('keeps the character budget aligned with the character pipeline game tier (40k)', () => {
    expect(polycountFor('character')?.faceLimit).toBe(40_000);
  });

  it('polycountFor resolves known classes and returns undefined for unknown ones', () => {
    expect(polycountFor('weapon')?.assetClass).toBe('weapon');
    expect(polycountFor('nope')).toBeUndefined();
  });
});

describe('planPartBudget (part-split generation vs the assembled budget)', () => {
  it('shrinks the per-part budget when the parts would overrun the assembled whole', () => {
    // 8 parts at the 8k modular-part budget = 64k, well past the 40k character budget.
    const plan = planPartBudget('character', 8);
    expect(plan?.constrained).toBe(true);
    expect(plan?.assembledFaceLimit).toBe(40_000);
    expect(plan?.perPartFaceLimit).toBe(5_000);
    expect((plan?.perPartFaceLimit ?? 0) * 8).toBeLessThanOrEqual(40_000);
  });

  it('keeps the full modular-part budget when the parts already fit', () => {
    const plan = planPartBudget('character', 2); // 2 × 8k = 16k, inside 40k
    expect(plan?.constrained).toBe(false);
    expect(plan?.perPartFaceLimit).toBe(8_000);
  });

  it('never returns a budget it cannot honour', () => {
    expect(planPartBudget('character', 0)).toBeUndefined();
    expect(planPartBudget('character', -3)).toBeUndefined();
    expect(planPartBudget('nope', 4)).toBeUndefined();
  });
});

describe('critiqueThresholdsFor + scoreMesh (class-aware tier-1 gate)', () => {
  it('a character mesh over its class budget warns where the class-blind default passed', () => {
    const fatCharacter = cleanMesh(150_000); // under the 200k default, over the character warn line
    expect(scoreMesh(fatCharacter).verdict).toBe('pass');
    const classAware = scoreMesh(fatCharacter, critiqueThresholdsFor('character'));
    expect(classAware.verdict).toBe('warn');
    expect(classAware.reasons.join(' ')).toMatch(/face count/i);
  });

  it('a mesh inside its class budget still passes', () => {
    expect(scoreMesh(cleanMesh(30_000), critiqueThresholdsFor('character')).verdict).toBe('pass');
    expect(scoreMesh(cleanMesh(8_000), critiqueThresholdsFor('prop')).verdict).toBe('pass');
  });

  it('unknown class yields empty thresholds (defaults apply, nothing breaks)', () => {
    expect(critiqueThresholdsFor('nope')).toEqual({});
    expect(scoreMesh(cleanMesh(150_000), critiqueThresholdsFor('nope')).verdict).toBe('pass');
  });
});
