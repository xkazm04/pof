import { describe, it, expect } from 'vitest';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'duration', durationSec: 3, cooldownSec: 1,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: ['State.Burning'],
}];
const tagRules: TagRule[] = [
  { id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' },
  { id: 'r2', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Channeling', type: 'requires' },
];

describe('buildGenerateAbilityBundlePrompt', () => {
  it('Part A — names the ability and enumerates each effect with its detail', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Fireball');
    expect(p).toContain('Fire Strike');
    expect(p).toContain('Health');
    expect(p).toMatch(/-40/);
    expect(p).toContain('State.Burning');
  });

  it('Part A — points at the real GE idiom + additive Effects/Generated/ folder', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Effects/Generated/');
    expect(p).toContain('UGE_Gen_');
    expect(p).toContain('ARPGAttributeSet');
    expect(p).toContain('FGameplayEffectModifierMagnitude'); // proven idiom (not bare FScalableFloat(x))
    expect(p).toContain('UTargetTagsGameplayEffectComponent'); // proven granted-tag idiom
    expect(p).toMatch(/GE_Stun/);
  });

  it('Part B — instructs the wiring ability + maps tag rules to activation tags', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Abilities/Generated/');
    expect(p).toContain('UGA_Gen_');
    expect(p).toMatch(/ARPGGameplayAbility/);
    expect(p).toMatch(/GA_WarCry/);
    expect(p).toContain('ActivationBlockedTags');   // blocks
    expect(p).toContain('ActivationRequiredTags');  // requires
    expect(p).toContain('CancelAbilitiesWithTag');  // cancels
    expect(p).toContain('StaticClass');             // references the generated GE classes
  });

  it('Part B — threads the mana-cost scalar when supplied', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules, { manaCost: 15, cooldown: 6 });
    expect(p).toContain('AbilityManaCost = 15');
  });

  it('pins the primary damage modifier to the canonical damage scalar', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules, { damage: 35 });
    expect(p).toMatch(/canonical damage/i);
    expect(p).toContain('-35'); // the primary Health modifier must equal -<damage>
  });

  it('Part C — instructs the build + report + tag-delta manifest', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toMatch(/build/i);
    expect(p).toMatch(/PoF\*?\.log|Saved\/Logs/);
    expect(p).toContain('README.md');
  });

  it('Part D — instructs the manifest merge + DataTable seeder run', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('manifest.json');
    expect(p).toContain('/Script/PoF.GA_Gen_'); // soft-class path format in the manifest
    expect(p).toContain('seed_generated_abilities.py');
    expect(p).toContain('DT_GeneratedAbilities');
  });

  it('handles an ability with no effects without crashing', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, [], []);
    expect(p).toContain('Fireball');
    expect(typeof p).toBe('string');
  });
});
