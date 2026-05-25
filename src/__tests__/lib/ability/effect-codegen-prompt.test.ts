import { describe, it, expect } from 'vitest';
import { buildGenerateEffectsPrompt } from '@/lib/ability/effect-codegen-prompt';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'duration', durationSec: 3, cooldownSec: 1,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: ['State.Burning'],
}];
const tagRules: TagRule[] = [{ id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' }];

describe('buildGenerateEffectsPrompt', () => {
  it('names the ability and enumerates each effect with its detail', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toContain('Fireball');
    expect(p).toContain('Fire Strike');
    expect(p).toContain('Health');     // modifier attribute
    expect(p).toMatch(/-40/);          // modifier magnitude
    expect(p).toContain('State.Burning'); // granted tag
    expect(p).toMatch(/duration/i);    // duration policy info
  });

  it('points Claude at the real UE references and the additive Generated/ folder', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toContain('Effects/Generated/');
    expect(p).toContain('UGE_Gen_');
    expect(p).toContain('ARPGAttributeSet');
    expect(p).toContain('ARPGGameplayTags');
    expect(p).toMatch(/GE_Heal/); // read an existing GE for the idiom
  });

  it('instructs the build + report step and lists the tag delta source', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toMatch(/build/i);
    expect(p).toMatch(/PoF\*?\.log|Saved\/Logs/);   // judge by abslog
    expect(p).toContain('README.md');               // tag-delta manifest
  });

  it('handles an ability with no effects without crashing', () => {
    const p = buildGenerateEffectsPrompt(ref, [], []);
    expect(p).toContain('Fireball');
    expect(typeof p).toBe('string');
  });
});
