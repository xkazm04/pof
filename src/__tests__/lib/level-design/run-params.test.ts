/**
 * The seed field accepts only what the UE generators can represent.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract`: the recorded seed must be the seed that ran.
 * `ARPGLevelGenerator::RandomSeed` is an int32 fed an unsigned 32-bit value.
 */
import { describe, it, expect } from 'vitest';
import { validateSeed, SEED_MAX } from '@/lib/level-design/run-params';

describe('validateSeed upper bound', () => {
  it('accepts the largest unsigned 32-bit seed', () => {
    expect(SEED_MAX).toBe(4294967295);
    expect(validateSeed('4294967295')).toBeNull();
  });

  it('rejects the first seed past 32 bits and far larger ones', () => {
    expect(validateSeed('4294967296')).toBe('Seed must be at most 4294967295');
    expect(validateSeed('99999999999')).toBe('Seed must be at most 4294967295');
  });

  it('keeps the existing rules', () => {
    expect(validateSeed('0')).toBeNull();
    expect(validateSeed('')).toBe('Enter a seed');
    expect(validateSeed('-1')).toBe('Seed must be 0 or greater');
  });
});
