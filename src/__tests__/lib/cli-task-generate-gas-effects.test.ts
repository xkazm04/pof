import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'instant', durationSec: 0, cooldownSec: 0,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: [],
}];
const tagRules: TagRule[] = [{ id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' }];

describe('generate-gas-effects task (ECW B3a + B3b bundle)', () => {
  it('TaskFactory.generateGasEffects builds a typed task and carries scalars', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules, scalars: { manaCost: 20, cooldown: 6 } }, 'http://localhost:3000', 'Gen C++ Fireball');
    expect(t.type).toBe('generate-gas-effects');
    expect(t.ref.name).toBe('Fireball');
    expect(t.effects).toHaveLength(1);
    expect(t.scalars?.manaCost).toBe(20);
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt embeds the GE + ability bundle contract and is callback-free', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules, scalars: { manaCost: 20 } }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('Fire Strike');
    expect(prompt).toContain('Effects/Generated/');   // Part A
    expect(prompt).toContain('Abilities/Generated/');  // Part B
    expect(prompt).toContain('UGA_Gen_');
    expect(prompt).toContain('AbilityManaCost = 20');  // scalar threaded
    expect(prompt).not.toContain('@@CALLBACK');        // callback-free
  });

  it('omits the mana cost when no scalars are supplied', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toMatch(/TODO: mana cost/);
  });

  it('the assembled prompt includes the B3c manifest + seeder registration step', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('manifest.json');
    expect(prompt).toContain('seed_generated_abilities.py');
    expect(prompt).toContain('DT_GeneratedAbilities');
  });
});
