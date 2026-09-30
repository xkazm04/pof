import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { SPELL_SPECS, spellLawParity } from '@/lib/catalog/reference/spellSpecs';

describe('Diablo I vanilla spell specifications', () => {
  it('covers each of the 35 vanilla spell IDs exactly once and excludes Hellfire Rage', () => {
    expect(SPELL_SPECS).toHaveLength(35);
    expect(new Set(SPELL_SPECS.map((spec) => spec.spell)).size).toBe(35);
    expect(SPELL_SPECS.some((spec) => spec.spell === 'Rage')).toBe(false);
  });

  it('has one short spellbook law per spec', () => {
    for (const spec of SPELL_SPECS) {
      const law = DIABLO1_CANON.find((candidate) => candidate.id === spec.lawId);
      expect(law?.scope, spec.spell).toBe('spellbook');
      expect(law?.body.length, spec.spell).toBeLessThanOrEqual(450);
    }
  });

  it('keeps every formula integer visible in its law or in a reasoned allowance', () => {
    expect(spellLawParity()).toEqual([]);
    for (const spec of SPELL_SPECS) {
      for (const allowance of spec.notInLaw ?? []) expect(allowance.reason.trim().length).toBeGreaterThan(10);
    }
  });
});
