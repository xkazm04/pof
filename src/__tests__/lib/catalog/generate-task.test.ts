import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { GenerateTask } from '@/lib/cli-task';
import type { AbilityEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.7', dynamicContext: undefined,
};
const fireball: AbilityEntry = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: {
    id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 35, manaCost: 20, cooldown: 3, radar: [0.7, 0.85, 0.3, 0.5, 0.5],
    description: 'Hurl a ball of fire', color: '#f00', tag: 'Ability.Fire.Fireball',
  },
};

describe('TaskFactory.generate', () => {
  it('builds a generate task carrying entity + step + origin', () => {
    const t = TaskFactory.generate('arpg-gas', fireball, 'scaffold-cpp', 'http://localhost:3000', 'Gen Fireball');
    expect(t.type).toBe('generate');
    expect(t.step).toBe('scaffold-cpp');
    expect(t.entity.id).toBe('ga-fireball');
  });
});

describe('buildTaskPrompt(generate)', () => {
  const t: GenerateTask = TaskFactory.generate('arpg-gas', fireball, 'scaffold-cpp', 'http://localhost:3000', 'Gen Fireball');
  const prompt = buildTaskPrompt(t, ctx);

  it('embeds the recipe step prompt (asset spec + GAS convention)', () => {
    expect(prompt).toContain('Asset Specification');
    expect(prompt).toContain('Ability.Fire.Fireball');
    expect(prompt).toContain('UARPGGameplayAbility');
  });
  it('includes a @@CALLBACK block requesting ueAssets', () => {
    expect(prompt).toContain('@@CALLBACK:');
    expect(prompt).toContain('ueAssets');
  });
});
