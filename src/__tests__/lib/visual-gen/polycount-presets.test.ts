import { describe, it, expect } from 'vitest';
import {
  POLYCOUNT_PRESETS,
  ASSET_CLASS_IDS,
  polycountFor,
  critiqueThresholdsFor,
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
