import { describe, it, expect } from 'vitest';
import { calculateDamage, formulaPreview } from '@/lib/ability/damage-formula';

describe('calculateDamage', () => {
  it('matches the legacy formula at the legacy defaults', () => {
    // 50*(1+100/100)=100; armorRed 50/150=.3333; afterArmor 100*.6667=66.67;
    // expectedCrit 1+.15*(1.5-1)=1.075; final 66.67*1.075 ≈ 71.67
    expect(calculateDamage(50, 100, 50, 15, 1.5)).toBeCloseTo(71.67, 1);
  });
  it('no power/armor/crit → base damage', () => {
    expect(calculateDamage(40, 0, 0, 0, 1.5)).toBeCloseTo(40, 5);
  });
  it('armor mitigates', () => {
    expect(calculateDamage(100, 0, 100, 0, 1)).toBeCloseTo(50, 5); // 100*(1-100/200)
  });
});

describe('formulaPreview', () => {
  it('mentions the base damage', () => {
    expect(formulaPreview({ damage: 40 })).toContain('40');
  });
});
