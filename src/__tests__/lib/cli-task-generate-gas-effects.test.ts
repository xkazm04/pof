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
const tagRules: TagRule[] = [];

describe('generate-gas-effects task (ECW B3a)', () => {
  it('TaskFactory.generateGasEffects builds a typed task', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen C++ Fireball');
    expect(t.type).toBe('generate-gas-effects');
    expect(t.ref.name).toBe('Fireball');
    expect(t.effects).toHaveLength(1);
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt embeds the authoring contract and is callback-free', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('Fire Strike');
    expect(prompt).toContain('Effects/Generated/');
    expect(prompt).not.toContain('@@CALLBACK'); // callback-free, like character-setup
  });
});
