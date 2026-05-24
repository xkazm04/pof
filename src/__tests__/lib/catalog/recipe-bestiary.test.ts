import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { BestiaryEntry } from '@/lib/catalog/types';
import { ARCHETYPES } from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const realBrute = ARCHETYPES.find((a) => a.id === 'brute')!;
const sampleEntry: BestiaryEntry = {
  id: `bestiary-${realBrute.id}`,
  catalogId: 'bestiary',
  name: realBrute.label,
  categoryPath: ['Bestiary', realBrute.tier, realBrute.role],
  tags: [realBrute.class, realBrute.category],
  lifecycle: 'planned',
  data: realBrute,
};

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
});
