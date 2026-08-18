import { describe, it, expect } from 'vitest';
import { calculateDamage, formulaPreview, legacyArmorMitigation } from '@/lib/ability/damage-formula';

/**
 * These numbers MOVED on 2026-08-18: the GAS preview was migrated off its private
 * `armor/(armor+100)` model onto the canon kernel's hit-size soft-cap
 * `armour/(armour + 5·rawHit)` (and a 95%-capped crit). The retired expectations are
 * kept inline so the shift is legible rather than silently rewritten.
 */
describe('calculateDamage (canon kernel)', () => {
  it('mitigates through the canon soft-cap, not the retired curve', () => {
    // raw 50*(1+100/100)=100. non-crit: 50/(50+5*100)=9.09% → 90.91.
    // crit (×1.5 → raw 150): 50/(50+750)=6.25% → 140.63. E[15% crit] = 98.36.
    // RETIRED model gave 71.67 (armor 50/150 = 33.3% flat, crit applied after armour).
    expect(calculateDamage(50, 100, 50, 15, 1.5)).toBeCloseTo(98.36, 1);
  });
  it('no power/armor/crit → base damage', () => {
    expect(calculateDamage(40, 0, 0, 0, 1.5)).toBeCloseTo(40, 5);
  });
  it('armor mitigates against the hit size', () => {
    // 100 armour vs a 100 hit → 100/(100+500) = 16.67% reduction → 83.33.
    // RETIRED model gave 50 (armour was hit-independent: 100/200 = 50%).
    expect(calculateDamage(100, 0, 100, 0, 1)).toBeCloseTo(83.33, 1);
    expect(legacyArmorMitigation(100)).toBeCloseTo(0.5, 5); // the retired curve, comparison only
  });
});

describe('formulaPreview', () => {
  it('mentions the base damage', () => {
    expect(formulaPreview({ damage: 40 })).toContain('40');
  });
  it('names the canon model, not the retired one', () => {
    expect(formulaPreview({ damage: 40 })).toContain('canon-mitigated');
  });
});
