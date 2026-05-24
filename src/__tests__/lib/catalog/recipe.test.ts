import { describe, it, expect } from 'vitest';
import { getRecipe, STEP_TO_LIFECYCLE, SPELLBOOK_RECIPE } from '@/lib/catalog/recipe';
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

describe('getRecipe', () => {
  it('returns the spellbook recipe for the spellbook catalog', () => {
    expect(getRecipe('spellbook')).toBe(SPELLBOOK_RECIPE);
  });
  it('returns undefined for a catalog with no recipe yet', () => {
    expect(getRecipe('bestiary')).toBeUndefined();
  });
});

describe('STEP_TO_LIFECYCLE', () => {
  it('maps each step to its resulting lifecycle', () => {
    expect(STEP_TO_LIFECYCLE['scaffold-cpp']).toBe('scaffolded');
    expect(STEP_TO_LIFECYCLE['author-python']).toBe('generated');
    expect(STEP_TO_LIFECYCLE['wire']).toBe('wired');
    expect(STEP_TO_LIFECYCLE['verify']).toBe('verified');
  });
});

describe('SPELLBOOK_RECIPE.buildStepPrompt', () => {
  it('orders the four pipeline steps', () => {
    expect(SPELLBOOK_RECIPE.steps).toEqual(['scaffold-cpp', 'author-python', 'wire', 'verify']);
  });
  it('embeds the ability spec (name, tag) + GAS convention in the scaffold prompt', () => {
    const p = SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'scaffold-cpp', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain('Ability.Fire.Fireball');
    expect(p).toContain('Fireball');
    expect(p).toContain('UARPGGameplayAbility');
  });
  it('references the functional test in the verify prompt', () => {
    const p = SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'verify', ctx);
    expect(p).toContain(SPELLBOOK_RECIPE.testPath!);
  });
});
