import { describe, it, expect } from 'vitest';
import {
  CHARACTERS_RECIPE,
  ITEMS_RECIPE,
  SPELLBOOK_RECIPE,
} from '@/lib/catalog/recipe';
import type { ProjectContext } from '@/lib/prompt-context';
import type { CharacterEntry, ItemEntry, AbilityEntry } from '@/lib/catalog/types';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.7.2' };

const character: CharacterEntry = {
  id: 'ch-vael', catalogId: 'characters', name: 'Vael',
  categoryPath: ['NPC'], tags: [], lifecycle: 'planned',
  data: { npcId: 'Vael', role: 'Merchant', attributeRowName: 'Vael' } as unknown as CharacterEntry['data'],
};
const item: ItemEntry = {
  id: 'itm-sword', catalogId: 'items', name: 'Rusty Sword',
  categoryPath: ['Weapons'], tags: ['common'], lifecycle: 'planned',
  data: {} as ItemEntry['data'],
};
const ability: AbilityEntry = {
  id: 'ab-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: { tag: 'Ability.Fireball' } as AbilityEntry['data'],
};

/**
 * Closes the silent CI gap: before this, every catalog recipe prompt hardcoded
 * `ue-cpp` with no module, so python-authoring steps carried ZERO python gotchas
 * and ZERO known-asset paths. These assert the knowledge system now reaches the
 * catalog generate-pipeline.
 */
describe('recipe knowledge routing (Direction: catalog-knowledge-blackout)', () => {
  it('a python-authoring recipe step carries a python-only gotcha', () => {
    const prompt = CHARACTERS_RECIPE.buildStepPrompt(character, 'author-python', CTX);
    // interchange-fbx-commandlet-crash is appliesTo: ['ue-python'] only — it can
    // ONLY appear if promptKind routed to ue-python for this step.
    expect(prompt).toContain('Interchange');
    expect(prompt).toContain('## Known UE Pitfalls');
  });

  it('a python-authoring recipe step carries the scoped known-asset paths', () => {
    const prompt = CHARACTERS_RECIPE.buildStepPrompt(character, 'author-python', CTX);
    expect(prompt).toContain('## Known Project Assets');
    // arpg-character → character/animation domains → the mannequin mesh path.
    expect(prompt).toContain('SKM_Manny');
  });

  it('items author-python surfaces the item-definition known asset', () => {
    const prompt = ITEMS_RECIPE.buildStepPrompt(item, 'author-python', CTX);
    expect(prompt).toContain('ARPGItemDefinition');
  });

  it('a C++ scaffold step does NOT carry python-only gotchas', () => {
    const prompt = SPELLBOOK_RECIPE.buildStepPrompt(ability, 'scaffold-cpp', CTX);
    // ue-python-only pitfall must be absent from a ue-cpp step.
    expect(prompt).not.toContain('Interchange FBX path crashes');
  });
});
