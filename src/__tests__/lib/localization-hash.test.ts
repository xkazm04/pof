import { describe, it, expect } from 'vitest';
import { hashString } from '@/lib/localization/hash';

describe('localization hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('Fireball')).toBe(hashString('Fireball'));
  });

  it('always returns a non-negative integer', () => {
    for (const s of ['', 'a', 'Health Potion', 'A New Beginning', '日本語', '~!@#$%']) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  it('hashes the empty string to 0', () => {
    expect(hashString('')).toBe(0);
  });

  // Golden values lock the seeded-ID contract: changing the algorithm would
  // re-key every previously generated localization string/hazard ID.
  it('matches locked golden hashes', () => {
    expect(hashString('Fireball')).toBe(498707115);
    expect(hashString('Health Potion')).toBe(632138711);
  });
});
