/**
 * `validateRules` (extracted from TagRulesEditor's `validations` useMemo so it
 * can be tested without pulling in the component's chart-colors import chain).
 *
 * Deliberately defines its own minimal fixtures rather than importing from
 * blueprint/data.ts, which transitively imports @/lib/chart-colors.
 */
import { describe, it, expect } from 'vitest';
import { validateRules } from '@/lib/ability/tag-rules';
import type { EditorEffect, GASLoadoutSlot, TagRule } from '@/lib/gas-codegen';

const FIREBALL = 'Ability.Fire.Fireball';

const stunEffect: EditorEffect = {
  id: 'e1', name: 'GE_Stun', duration: 'duration', durationSec: 2, cooldownSec: 0,
  color: '#fff', modifiers: [], grantedTags: ['State.Stunned'],
};

const loadoutSlot: GASLoadoutSlot = { id: 'l1', slot: 1, abilityName: 'Fireball', iconColor: '#fff', cooldownTag: 'Cooldown.Fireball' };

describe('validateRules — Unmatched gating tags', () => {
  it('a gating tag no effect grants and no loadout slot names is unmatched', () => {
    const rule: TagRule = { id: 't1', sourceTag: FIREBALL, targetTag: 'State.Ghost', type: 'blocks' };
    const result = validateRules([rule], [stunEffect], [loadoutSlot]);
    expect(result.get('t1')).toEqual({ gateUnmatched: true, conflict: null });
  });

  it('a gating tag an effect grants is matched', () => {
    const rule: TagRule = { id: 't1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'blocks' };
    const result = validateRules([rule], [stunEffect], [loadoutSlot]);
    expect(result.get('t1')?.gateUnmatched).toBe(false);
  });

  it('a gating tag a loadout slot\'s cooldown names is matched', () => {
    const rule: TagRule = { id: 't1', sourceTag: FIREBALL, targetTag: 'Cooldown.Fireball', type: 'blocks' };
    const result = validateRules([rule], [stunEffect], [loadoutSlot]);
    expect(result.get('t1')?.gateUnmatched).toBe(false);
  });

  it('a wildcard-ending gating tag is never judged unmatched', () => {
    const rule: TagRule = { id: 't1', sourceTag: FIREBALL, targetTag: 'State.', type: 'blocks' };
    const result = validateRules([rule], [], []);
    expect(result.get('t1')?.gateUnmatched).toBe(false);
  });

  it('an empty gating tag is never judged unmatched', () => {
    const rule: TagRule = { id: 't1', sourceTag: FIREBALL, targetTag: '', type: 'blocks' };
    const result = validateRules([rule], [], []);
    expect(result.get('t1')?.gateUnmatched).toBe(false);
  });
});

describe('validateRules — blocks vs requires conflicts', () => {
  it('flags a blocks rule that contradicts a requires rule on the same ability + gating tag', () => {
    const blocks: TagRule = { id: 'b1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'blocks' };
    const requires: TagRule = { id: 'r1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'requires' };
    const result = validateRules([blocks, requires], [], []);
    expect(result.get('b1')?.conflict).toBe('Conflicts with "requires State.Stunned"');
    expect(result.get('r1')?.conflict).toBe('Conflicts with "blocked by State.Stunned"');
  });

  it('does not flag two blocks rules on the same gating tag', () => {
    const b1: TagRule = { id: 'b1', sourceTag: FIREBALL, targetTag: 'State.Dead', type: 'blocks' };
    const b2: TagRule = { id: 'b2', sourceTag: FIREBALL, targetTag: 'State.Dead', type: 'blocks' };
    const result = validateRules([b1, b2], [], []);
    expect(result.get('b1')?.conflict).toBeNull();
    expect(result.get('b2')?.conflict).toBeNull();
  });

  it('does not flag a blocks/requires pair on different abilities', () => {
    const blocks: TagRule = { id: 'b1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'blocks' };
    const requires: TagRule = { id: 'r1', sourceTag: 'Ability.Melee.Slash', targetTag: 'State.Stunned', type: 'requires' };
    const result = validateRules([blocks, requires], [], []);
    expect(result.get('b1')?.conflict).toBeNull();
    expect(result.get('r1')?.conflict).toBeNull();
  });

  it('cancels rules are never flagged as conflicting', () => {
    const cancels: TagRule = { id: 'c1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'cancels' };
    const requires: TagRule = { id: 'r1', sourceTag: FIREBALL, targetTag: 'State.Stunned', type: 'requires' };
    const result = validateRules([cancels, requires], [], []);
    expect(result.get('c1')?.conflict).toBeNull();
  });
});
