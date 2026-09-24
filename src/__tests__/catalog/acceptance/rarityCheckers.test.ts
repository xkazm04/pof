// /diablo W11 (D4): rarity belongs to the dropped INSTANCE (registry rarity-is-an-affix-budget; UE rolls it per drop),
// so a BASE TYPE declares `rarityRolled: true` instead of carrying one; an authored item (a unique, a set piece, a
// legendary) keeps its fixed rarity. Either satisfies the step — a declared gap or nothing does not.
import { describe, it, expect } from 'vitest';
import { rarityOrRolled } from '@/lib/catalog/acceptance/rarityCheckers';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = rarityOrRolled('baseType', 'Rarity fixed or rolled per drop');

describe('rarityOrRolled', () => {
  it('passes an authored item with a fixed rarity', () => {
    expect(check({ baseType: { rarity: 'Legendary' } }).status).toBe('pass');
  });
  it('passes a base type that declares its rarity is rolled per drop', () => {
    expect(check({ baseType: { rarityRolled: true } }).status).toBe('pass');
  });
  it('holds a missing rarity, a declared gap, or a rolled flag that is not true', () => {
    expect(check({ baseType: {} }).status).toBe('pending');
    expect(check({ baseType: { rarity: REFERENCE_GAP } }).status).toBe('pending');
    expect(check({ baseType: { rarityRolled: 'yes' } }).status).toBe('pending');
  });
  it('tells the producer both ways', () => {
    const shape = requiredFieldsOf(check).find((r) => r.field === 'baseType')?.shape ?? '';
    expect(shape).toMatch(/rarityRolled: true/);
  });
});
