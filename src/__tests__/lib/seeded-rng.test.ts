import { describe, it, expect } from 'vitest';
import { createXorShift32RNG } from '@/lib/seeded-rng';

describe('createXorShift32RNG', () => {
  it('seed 0 produces a distinct stream from seed 1 (no zero-state alias)', () => {
    const a = createXorShift32RNG(0);
    const b = createXorShift32RNG(1);
    // Pull a few values: the streams must differ, otherwise a "seed 0" sweep is
    // silently identical to seed 1 and the determinism guarantee is a lie.
    const av = [a(), a(), a()];
    const bv = [b(), b(), b()];
    expect(av).not.toEqual(bv);
  });

  it('is deterministic for a given seed', () => {
    const first = [createXorShift32RNG(7)(), createXorShift32RNG(7)()];
    expect(first[0]).toBe(first[1]);
  });

  it('produces values in [0, 1)', () => {
    const r = createXorShift32RNG(0);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
