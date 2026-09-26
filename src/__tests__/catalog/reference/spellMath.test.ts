import { describe, expect, it } from 'vitest';
import { damage, damageOutcomes, manaCost, scaleSpellEffect } from '@/lib/catalog/reference/spellMath';

const inputs = { spellLevel: 1, characterLevel: 3, magic: 20 };

describe('damage', () => {
  it('evaluates direct projectile spells with engine truncation', () => {
    expect(damage('Firebolt', { spellLevel: 1, characterLevel: 5, magic: 20 }))
      .toEqual({ min: 4, max: 13, mean: 8.5 }); // trunc(20/8)+1+1+R(10) = 4..13.
    expect(damage('Guardian', { ...inputs, characterLevel: 5 }))
      .toEqual({ min: 3, max: 13, mean: 8 }); // Scale(3..12,1) = 3..7,9..13.
    expect(damage('FlameWave', inputs)).toEqual({ min: 4, max: 13, mean: 8.5 }); // 3+1+R(10).
    expect(damage('ChargedBolt', inputs)).toEqual({ min: 1, max: 5, mean: 3 }); // R(trunc(20/4))+1.
    expect(damage('HolyBolt', inputs)).toEqual({ min: 12, max: 21, mean: 16.5 }); // 3+9+R(10).
    expect(damage('BloodStar', { ...inputs, spellLevel: 2, magic: 21 }))
      .toEqual({ min: 14, max: 14, mean: 14 }); // 3*2-trunc(21/8)+trunc(21/2).
  });

  it('enumerates scaled sum distributions instead of averaging only their bounds', () => {
    expect(damage('Fireball', inputs)).toEqual({ min: 11, max: 51, mean: 31.12 });
    // Five d6-style engine rolls have 6^5=7776 outcomes; floor-before-Scale makes mean non-midpoint.
    expect(damage('Nova', { ...inputs, characterLevel: 4 })).toEqual({
      min: 4,
      max: 19,
      mean: 11.443930041152264,
    });
    // Elemental halves each already-scaled outcome: 100 two-R(10) outcomes total 1530 HP.
    expect(damage('Elemental', inputs)).toEqual({ min: 5, max: 25, mean: 15.3 });
    expect(damageOutcomes('Fireball', inputs).reduce((sum, outcome) => sum + outcome.weight, 0)).toBe(100);
  });

  it('converts fixed-point per-tick damage to displayed HP', () => {
    expect(damage('FireWall', { ...inputs, characterLevel: 4 }))
      .toEqual({ min: 0.75, max: 3, mean: 1.875 }); // (4+2+two R(10))/8.
    expect(damage('Inferno', inputs))
      .toEqual({ min: 0.375, max: 0.9375, mean: 0.65625 }); // (24+12*(R(3)+R(2)))/64.
    expect(damage('Flash', { ...inputs, characterLevel: 1 })).toEqual({
      min: 3 / 64,
      max: 67 / 64,
      mean: 0.5394140625,
    }); // Enumerating 400 pairs of 1..20 preserves both Scale and half-damage truncation.
  });

  it('normalizes one segment, tick, or minion hit rather than total cast geometry', () => {
    expect(damage('Lightning', { ...inputs, characterLevel: 4 })).toEqual({ min: 2, max: 6, mean: 4 });
    expect(damage('ChainLightning', { ...inputs, characterLevel: 4 })).toEqual({ min: 2, max: 6, mean: 4 });
    expect(damage('Golem', { ...inputs, spellLevel: 2 })).toEqual({ min: 12, max: 20, mean: 16 });
    expect(damage('Apocalypse', { ...inputs, characterLevel: 2 })).toEqual({ min: 2, max: 12, mean: 7 });
  });

  it('uses current internal HP for Bone Spirit', () => {
    expect(damage('BoneSpirit', { ...inputs, targetCurrentHPInternal: 1000 }))
      .toEqual({ min: 5, max: 5, mean: 5 }); // trunc(trunc(1000/3)/64) = 5 HP.
    expect(() => damage('BoneSpirit', inputs)).toThrow(/targetCurrentHPInternal/);
    expect(() => damage('Healing', inputs)).toThrow(/does not deal damage/);
  });

  it('matches ScaleSpellEffect level-by-level truncation', () => {
    expect(scaleSpellEffect(15, 2)).toBe(18); // 15+trunc(15/8)=16; 16+trunc(16/8)=18.
  });
});

describe('manaCost', () => {
  const base = { spellLevel: 1, baseMana: 10, manaAdj: 3, minMana: 0, characterLevel: 3 };

  it('applies Firebolt adjustment after multiplying by levels above one', () => {
    expect(manaCost('Firebolt', { ...base, spellLevel: 4 })).toBe(6); // 10-trunc(3 levels*3/2)=6.
  });

  it('preserves fixed-point class adjustment and then applies the minimum floor', () => {
    expect(manaCost('Fireball', { ...base, baseMana: 5 }, 'Rogue')).toBe(3.75); // (5<<6)*3/4 /64.
    expect(manaCost('Fireball', { ...base, baseMana: 5, minMana: 4 }, 'Rogue')).toBe(4); // floor sees 240>>6 = 3.
    expect(manaCost('Fireball', { ...base, baseMana: 9, hellfire: true }, 'Sorcerer')).toBe(4.5);
  });

  it('implements Healing, Resurrect, max-mana, and Skill branches', () => {
    expect(manaCost('Healing', { ...base, spellLevel: 2, baseMana: 7, manaAdj: 2 })).toBe(11); // 7+2*3-2.
    expect(manaCost('HealOther', { ...base, healingBaseMana: 7 })).toBe(13); // Healing base 7+2*level 3.
    expect(manaCost('Resurrect', { ...base, spellLevel: 3, baseMana: 17 })).toBe(13); // 17-2*trunc(17/8).
    expect(manaCost('ManaShield', { ...base, spellLevel: 2, baseMana: 255, maxManaBaseInternal: 20 * 64 })).toBe(17);
    expect(manaCost('ItemRepair', { ...base, castType: 'skill' })).toBe(0);
  });
});
