/**
 * Degenerate vegetation configs yield no points instead of throwing.
 * Species radius is user-editable; a zero radius gave an infinite grid (RangeError) and a
 * zero width or height gave an empty grid indexed unconditionally.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_VEGETATION_CONFIG, generateVegetation } from '@/lib/visual-gen/generators/vegetation';

const sp = (radius: number) => [{ id: 'a', name: 'A', radius, color: 'x' }];

describe('generateVegetation degenerate inputs', () => {
  it('radius 0, negative or NaN returns an empty scatter', () => {
    for (const radius of [0, -3, Number.NaN]) {
      const run = () => generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, species: sp(radius) });
      expect(run, `radius ${radius}`).not.toThrow();
      expect(run()).toEqual([]);
    }
  });

  it('zero width or zero height returns an empty scatter', () => {
    for (const dims of [{ width: 0 }, { height: 0 }, { width: 0, height: 0 }]) {
      const run = () => generateVegetation({ ...DEFAULT_VEGETATION_CONFIG, ...dims });
      expect(run, JSON.stringify(dims)).not.toThrow();
      expect(run()).toEqual([]);
    }
  });

  it('a valid config still scatters', () => {
    expect(generateVegetation(DEFAULT_VEGETATION_CONFIG).length).toBeGreaterThan(0);
  });
});
