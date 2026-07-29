import { describe, it, expect } from 'vitest';
import { toDottedTag, toCppTagName, toDottedTags } from '@/lib/ability/tag-dialect';

describe('tag-dialect — one mapper for both spellings', () => {
  it('C++ identifier → dotted tag string', () => {
    expect(toDottedTag('Ability_Melee_LightAttack')).toBe('Ability.Melee.LightAttack');
    expect(toDottedTag('State_Dead')).toBe('State.Dead');
  });

  it('is idempotent — an already-dotted tag passes through untouched', () => {
    expect(toDottedTag('Ability.Melee.LightAttack')).toBe('Ability.Melee.LightAttack');
    expect(toDottedTag(toDottedTag('State_Stunned'))).toBe('State.Stunned');
  });

  it('trims, and maps empty/whitespace to empty (never a bogus tag)', () => {
    expect(toDottedTag('  State_Dead  ')).toBe('State.Dead');
    expect(toDottedTag('   ')).toBe('');
    expect(toDottedTag('')).toBe('');
  });

  it('collapses repeated underscores rather than emitting empty segments', () => {
    expect(toDottedTag('Ability__Fire')).toBe('Ability.Fire');
  });

  it('toCppTagName is the inverse', () => {
    expect(toCppTagName('Ability.Fire.Fireball')).toBe('Ability_Fire_Fireball');
    expect(toDottedTag(toCppTagName('Ability.Fire.Fireball'))).toBe('Ability.Fire.Fireball');
  });

  it('toDottedTags normalizes, drops empties and de-dupes, keeping order', () => {
    expect(toDottedTags(['State_Dead', '', 'State.Dead', 'Ability_Fire', '  '])).toEqual([
      'State.Dead', 'Ability.Fire',
    ]);
  });
});
