import { describe, it, expect } from 'vitest';
import { progressionToUE5Loader } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator/helpers';

/** The C++ fallback must be the curve the CSV was generated from, not the shipped default. */
describe('progressionToUE5Loader fallback', () => {
  it('uses the tuned base and exponent', () => {
    const cpp = progressionToUE5Loader(250, 2.2);
    expect(cpp).toContain('FMath::FloorToFloat(250.f * FMath::Pow(static_cast<float>(Level), 2.2f))');
    expect(cpp).not.toContain('100.f * FMath::Pow(Level, 1.5f)');
  });

  it('writes a whole-number exponent as a valid float literal', () => {
    const cpp = progressionToUE5Loader(100, 2);
    expect(cpp).toContain(', 2.f))');
    expect(cpp).not.toMatch(/[ (]2f\b/);
  });
});
