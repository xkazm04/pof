import { describe, it, expect } from 'vitest';
import { isModifierExcluded, toggleModifier } from '@/lib/bestiary/modifier-exclusion';

/** Asymmetric on purpose: only `a` declares the conflict. */
const MODS = [{ id: 'a', excludes: ['b'] }, { id: 'b' }, { id: 'c' }];

describe('modifier exclusion rule', () => {
  it('adding b while a is active drops a (declared only on a)', () => {
    expect(toggleModifier(['a'], 'b', MODS)).toEqual(['b']);
  });

  it('adding a while b is active drops b', () => {
    expect(toggleModifier(['b'], 'a', MODS)).toEqual(['a']);
  });

  it('keeps unrelated modifiers and removes on re-toggle', () => {
    expect(toggleModifier(['a', 'c'], 'b', MODS)).toEqual(['c', 'b']);
    expect(toggleModifier(['a', 'c'], 'a', MODS)).toEqual(['c']);
  });

  it('b is excluded while a is active, from either side', () => {
    expect(isModifierExcluded('b', ['a'], MODS)).toBe(true);
    expect(isModifierExcluded('a', ['b'], MODS)).toBe(true);
    expect(isModifierExcluded('c', ['a'], MODS)).toBe(false);
  });

  it('an active modifier is never reported excluded', () => {
    expect(isModifierExcluded('a', ['a'], MODS)).toBe(false);
  });
});
