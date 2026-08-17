import { describe, it, expect } from 'vitest';
import {
  GENERATOR_NORMALIZED_EXTENT_M,
  SCALE_TOLERANCE,
  NOMINAL_EXTENT_M,
  longestExtent,
  isGeneratorNormalized,
  nominalExtentFor,
  gradeWorldScale,
  type SizeRequest,
} from '@/lib/visual-gen/world-scale';

const size = (targetExtentM: number): SizeRequest => ({ targetExtentM });

describe('world-scale constants', () => {
  it('names the 1 m longest-extent every generator normalises to', () => {
    // Measured 2026-08-17 over every .glb under generated/: Tripo cloud (jinx 1.000),
    // TripoSR (bestof_fg085 1.069), mesh library (crate 1.000, saber hilt 1.017).
    expect(GENERATOR_NORMALIZED_EXTENT_M).toBe(1.0);
  });

  it('carries a nominal only where one is honest — the UE5 Mannequin height for characters', () => {
    expect(NOMINAL_EXTENT_M.character).toBeCloseTo(1.8);
    expect(nominalExtentFor('character')).toBeCloseTo(1.8);
    // A prop can be a coin or a wagon — no honest class-wide size exists, so none is invented.
    expect(nominalExtentFor('prop')).toBeUndefined();
    expect(nominalExtentFor('weapon')).toBeUndefined();
    expect(nominalExtentFor('unknown-class')).toBeUndefined();
  });
});

describe('longestExtent / isGeneratorNormalized', () => {
  it('reads the longest bbox axis', () => {
    expect(longestExtent([0.392, 1.0, 0.588])).toBe(1.0);
    expect(longestExtent([1.017, 0.161, 0.277])).toBe(1.017);
  });

  it('flags the fixtures captured from real generator output as normalised', () => {
    expect(isGeneratorNormalized([0.392, 1.0, 0.588])).toBe(true); // tripo3d/jinx.glb
    expect(isGeneratorNormalized([1.069, 0.569, 0.599])).toBe(true); // triposr/bestof_fg085.glb
    expect(isGeneratorNormalized([1.017, 0.161, 0.277])).toBe(true); // saber/saber_hilt.glb
  });

  it('does not flag a mesh that carries a real-world size', () => {
    expect(isGeneratorNormalized([0.6, 1.8, 0.4])).toBe(false); // a 1.8 m character
    expect(isGeneratorNormalized([0.3, 0.3, 0.3])).toBe(false); // a 30 cm prop
    expect(isGeneratorNormalized([0, 0, 0])).toBe(false);
  });
});

describe('gradeWorldScale', () => {
  it('is unmeasured (never "matches") when no size was requested — silence is not compliance', () => {
    const g = gradeWorldScale([0.392, 1.0, 0.588], undefined);
    expect(g.verdict).toBe('unmeasured');
    expect(g.measuredExtentM).toBe(1.0);
    expect(g.normalized).toBe(true);
    expect(g.reason).toMatch(/no target size/i);
    expect(g.importUniformScale).toBeUndefined();
  });

  it('is unmeasured when the mesh was not measured', () => {
    const g = gradeWorldScale(undefined, size(1.8));
    expect(g.verdict).toBe('unmeasured');
    expect(g.targetExtentM).toBe(1.8);
    expect(g.reason).toMatch(/not measured/i);
  });

  it('calls a 1 m hero OFF against the 1.8 m Mannequin and computes the import scale that fixes it', () => {
    // generated/tripo3d/jinx.glb — a hero character delivered 1.0 m tall.
    const g = gradeWorldScale([0.392, 1.0, 0.588], size(1.8));
    expect(g.verdict).toBe('off');
    expect(g.ratio).toBeCloseTo(1 / 1.8, 3);
    expect(g.importUniformScale).toBeCloseTo(1.8, 3);
    expect(g.normalized).toBe(true);
    expect(g.reason).toContain('1.00 m');
    expect(g.reason).toContain('1.80 m');
    expect(g.reason).toMatch(/normalis|normaliz/i);
    expect(g.reason).toContain('1.80');
  });

  it('matches within tolerance and still reports the correction factor', () => {
    const g = gradeWorldScale([0.6, 1.75, 0.4], size(1.8));
    expect(g.verdict).toBe('matches');
    expect(g.importUniformScale).toBeCloseTo(1.8 / 1.75, 3);
    expect(g.normalized).toBe(false);
  });

  it('tolerance is symmetric and tight enough to catch the 1 m trap on every class', () => {
    expect(SCALE_TOLERANCE).toBeLessThan(0.2);
    // A 1 m saber hilt against a 0.3 m target: 3.3x too big.
    const hilt = gradeWorldScale([1.017, 0.161, 0.277], size(0.3));
    expect(hilt.verdict).toBe('off');
    expect(hilt.importUniformScale).toBeCloseTo(0.3 / 1.017, 3);
    // A 1 m crate against a 1 m target: fine.
    expect(gradeWorldScale([1.0, 0.678, 0.992], size(1.0)).verdict).toBe('matches');
  });

  it('never invents a grade from an unusable target', () => {
    expect(gradeWorldScale([0.6, 1.8, 0.4], size(0)).verdict).toBe('unmeasured');
    expect(gradeWorldScale([0.6, 1.8, 0.4], size(Number.NaN)).verdict).toBe('unmeasured');
  });
});
