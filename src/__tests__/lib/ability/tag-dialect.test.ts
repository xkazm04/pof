import { describe, it, expect } from 'vitest';
import { toDottedTag, toDottedTags } from '@/lib/ability/tag-dialect';

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

  it('strips a C++ scope qualifier — engine syntax, not part of the tag', () => {
    expect(toDottedTag('ARPGGameplayTags::State_Dashing')).toBe('State.Dashing');
    expect(toDottedTag('ARPGGameplayTags::Ability.Fireball')).toBe('Ability.Fireball');
  });

  it('never emits an empty segment from edge separators', () => {
    expect(toDottedTag('State_Dead_')).toBe('State.Dead');
    expect(toDottedTag('_State_Dead')).toBe('State.Dead');
    expect(toDottedTag('State.Dead.')).toBe('State.Dead');
    expect(toDottedTag('___')).toBe('');
  });

  it('toDottedTags normalizes, drops empties and de-dupes, keeping order', () => {
    expect(toDottedTags(['State_Dead', '', 'State.Dead', 'Ability_Fire', '  '])).toEqual([
      'State.Dead', 'Ability.Fire',
    ]);
  });
});
