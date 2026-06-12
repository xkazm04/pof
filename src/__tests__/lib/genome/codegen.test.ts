import { describe, it, expect } from 'vitest';
import { cppFloat, generateSubclassCpp } from '@/lib/genome/codegen';
import { PRESET_GENOMES, createGenome } from '@/lib/genome/defaults';

/** Invalid C++ float literals the old template produced: `1f` (integer constant
 *  with float suffix) and `25.5.f` (double dot). */
const INVALID_INT_SUFFIX = /[^.\d]\d+f\b/;
const INVALID_DOUBLE_DOT = /\d+\.\d+\.f/;

describe('cppFloat', () => {
  it('emits .f for whole numbers (String(1.0) is "1")', () => {
    expect(cppFloat(1)).toBe('1.f');
    expect(cppFloat(10)).toBe('10.f');
    expect(cppFloat(0)).toBe('0.f');
    expect(cppFloat(-90)).toBe('-90.f');
  });

  it('emits plain f for fractional values', () => {
    expect(cppFloat(25.5)).toBe('25.5f');
    expect(cppFloat(0.12)).toBe('0.12f');
  });

  it('guards non-finite input to 0.f', () => {
    expect(cppFloat(NaN)).toBe('0.f');
    expect(cppFloat(Infinity)).toBe('0.f');
  });
});

describe('generateSubclassCpp float literals', () => {
  it('every preset genome compiles-clean literals (no `Nf` integer suffix, no `N.N.f`)', () => {
    for (const preset of PRESET_GENOMES) {
      const cpp = generateSubclassCpp(preset);
      expect(cpp).not.toMatch(INVALID_INT_SUFFIX);
      expect(cpp).not.toMatch(INVALID_DOUBLE_DOT);
    }
  });

  it('handles whole-number floats and fractional ints (the two old failure modes)', () => {
    const g = createGenome('LiteralTest', '#fff', {
      movement: { ...PRESET_GENOMES[0].movement, gravityScale: 1.0 },
      camera: { ...PRESET_GENOMES[0].camera, lagSpeed: 10 },
      dodge: { ...PRESET_GENOMES[0].dodge, staminaCost: 25.5 },
    });
    const cpp = generateSubclassCpp(g);
    expect(cpp).toContain('GravityScale = 1.f;');
    expect(cpp).toContain('CameraLagSpeed = 10.f;');
    expect(cpp).toContain('DodgeStaminaCost = 25.5f;');
    expect(cpp).not.toMatch(INVALID_INT_SUFFIX);
    expect(cpp).not.toMatch(INVALID_DOUBLE_DOT);
  });
});
