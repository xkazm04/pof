import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { BestiaryEntry } from '@/lib/catalog/types';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

function entryFor(archetypeId: string): BestiaryEntry {
  const a = ARCHETYPES.find((x) => x.id === archetypeId)!;
  return {
    id: `bestiary-${a.id}`,
    catalogId: 'bestiary',
    name: a.label,
    categoryPath: ['Bestiary', a.tier, a.role],
    tags: [a.class, a.category],
    lifecycle: 'planned',
    data: a,
  };
}
const realBrute = ARCHETYPES.find((a) => a.id === 'brute')!;
const sampleEntry = entryFor('brute');

describe('Bestiary recipe', () => {
  it('exists in the registry', () => {
    expect(getRecipe('bestiary')).toBeDefined();
  });
  it('author-python prompt names BP_*Enemy + AARPGEnemyCharacter', () => {
    const p = getRecipe('bestiary')!.buildStepPrompt(sampleEntry, 'author-python', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain(realBrute.label);
    expect(p).toContain('BP_');
    expect(p).toContain('AARPGEnemyCharacter');
  });
  it('verify prompt references the per-archetype functional test', () => {
    const p = getRecipe('bestiary')!.buildStepPrompt(sampleEntry, 'verify', ctx);
    expect(p).toContain('AVSBestiary');
  });
  it('wire prompt binds the real loot-tables id, never a templated kebab id', () => {
    const grunt = getRecipe('bestiary')!.buildStepPrompt(entryFor('melee-grunt'), 'wire', ctx);
    expect(grunt).toContain('lt-MeleeGrunt');
    expect(grunt).not.toContain('lt-melee-grunt');
    const brute = getRecipe('bestiary')!.buildStepPrompt(sampleEntry, 'wire', ctx);
    expect(brute).toContain('lt-Brute');
    expect(brute).not.toContain('lt-brute');
  });
  it('wire prompt for an archetype with no loot table says so instead of inventing an id', () => {
    const thug = getRecipe('bestiary')!.buildStepPrompt(entryFor('taris-thug'), 'wire', ctx);
    expect(thug).not.toContain('lt-taris-thug');
    expect(thug).toContain('no loot-tables entry is bound to this archetype');
  });
});
