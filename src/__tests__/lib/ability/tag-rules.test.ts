import { describe, it, expect } from 'vitest';
import { bindRulesToAbility, effectRuleLinks } from '@/lib/ability/tag-rules';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { TagRule } from '@/lib/ability/spec';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import { GAS_TEMPLATES } from '@/components/modules/core-engine/sub_ability/blueprint/templates';
import { SEED_EFFECTS, SEED_TAG_RULES } from '@/components/modules/core-engine/sub_ability/blueprint/data';

// Canonical TagRule direction is ability-owned: sourceTag = the ability,
// targetTag = the gating tag (what GAS stores on the ability itself and what
// deriveDefaultSpec / forge adoption / the draft-spec callback already write).
const FIREBALL = 'Ability.Fire.Fireball';
const FireballRef: AbilityRef = { name: 'Fireball', element: 'Fire', tag: FIREBALL, category: 'Offensive', tier: 'basic' };

/** The "- blocks "<tag>" → ActivationBlockedTags" bullets of a generate prompt. */
function blockedLines(prompt: string): string[] {
  return prompt.split('\n').filter((l) => l.startsWith('- blocks ') && l.includes('ActivationBlockedTags'));
}

describe('bindRulesToAbility — archetype patterns become the bound ability\'s own rules', () => {
  it('flips a subject-first rule whose target pattern matches the ability', () => {
    expect(bindRulesToAbility([{ id: 't1', sourceTag: 'State.Dead', targetTag: 'Ability.*', type: 'blocks' }], FIREBALL)).toEqual({
      rules: [{ id: 't1', sourceTag: FIREBALL, targetTag: 'State.Dead', type: 'blocks' }],
      dropped: [],
    });
  });

  it('drops a pattern that targets another ability instead of wiring it onto this one', () => {
    expect(bindRulesToAbility([{ id: 't4', sourceTag: 'State.Attacking', targetTag: 'Ability.Melee.*', type: 'blocks' }], FIREBALL)).toEqual({
      rules: [],
      dropped: [{ ruleId: 't4', reason: 'other-ability' }],
    });
  });

  it('passes an ability-owned rule through unchanged and is idempotent over every template', () => {
    const owned: TagRule = { id: 'o1', sourceTag: FIREBALL, targetTag: 'State.Dead', type: 'blocks' };
    expect(bindRulesToAbility([owned], FIREBALL)).toEqual({ rules: [owned], dropped: [] });
    for (const t of GAS_TEMPLATES) {
      const once = bindRulesToAbility(t.tagRules, FIREBALL).rules;
      expect(bindRulesToAbility(once, FIREBALL).rules, t.id).toEqual(once);
    }
  });

  it('drops a state->state rule as effect-level (never emitted as CancelAbilitiesWithTag)', () => {
    const r: TagRule = { id: 'c1', sourceTag: 'State.Cleansed', targetTag: 'State.Poisoned', type: 'cancels' };
    const bound = bindRulesToAbility([r], FIREBALL);
    expect(bound.rules).toEqual([]);
    expect(bound.dropped).toEqual([{ ruleId: 'c1', reason: 'effect-level' }]);
  });
});

describe('generate prompt wires the incapacitated states, never the ability namespace', () => {
  it('the seed rules produce State.Dead / State.Stunned blockers and no Ability.* / Damage.* lines', () => {
    const prompt = buildGenerateAbilityBundlePrompt(FireballRef, SEED_EFFECTS, SEED_TAG_RULES);
    expect(prompt).toContain('- blocks "State.Dead" → ActivationBlockedTags');
    expect(prompt).toContain('- blocks "State.Stunned" → ActivationBlockedTags');
    expect(prompt.split('\n').filter((l) => /- blocks "(Ability|Damage)\./.test(l))).toEqual([]);
  });

  it.each(GAS_TEMPLATES.map((t) => [t.id, t] as const))('template %s, bound to Fireball, blocks on State.Dead + State.Stunned', (_id, t) => {
    const prompt = buildGenerateAbilityBundlePrompt(FireballRef, t.effects, bindRulesToAbility(t.tagRules, FIREBALL).rules);
    const lines = blockedLines(prompt);
    expect(lines).toContain('- blocks "State.Dead" → ActivationBlockedTags');
    expect(lines).toContain('- blocks "State.Stunned" → ActivationBlockedTags');
    expect(lines.filter((l) => l.includes('"Ability.'))).toEqual([]);
  });
});

describe('effectRuleLinks — effects link to the rules whose gating tag they grant', () => {
  it('GE_Stun (grants State.Stunned) links to the derived Fireball block-stunned rule', () => {
    const derived = deriveDefaultSpec('spellbook', { id: 'off-fire-01', tag: FIREBALL, damage: 35, cooldown: 3 });
    expect(effectRuleLinks(SEED_EFFECTS, derived.tagRules)).toContainEqual({ effectId: 'e5', ruleId: 'off-fire-01-block-stunned' });
  });
});
