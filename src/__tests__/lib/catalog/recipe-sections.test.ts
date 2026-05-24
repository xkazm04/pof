import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ItemEntry, LootTableEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined,
};

describe('getRecipe for data-asset sections', () => {
  it('returns an items recipe whose author prompt names UARPGItemDefinition', () => {
    const r = getRecipe('items');
    expect(r).toBeDefined();
    const item: ItemEntry = {
      id: 'item-1', catalogId: 'items', name: 'Iron Longsword',
      categoryPath: ['Weapon', 'Common'], tags: ['Weapon', 'Sword'], lifecycle: 'planned',
      data: { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [], description: '' },
    };
    const p = r!.buildStepPrompt(item, 'author-python', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain('UARPGItemDefinition');
    expect(p).toContain('Iron Longsword');
  });

  it('returns a loot recipe whose author prompt names UARPGLootTable', () => {
    const r = getRecipe('loot-tables');
    expect(r).toBeDefined();
    const lt: LootTableEntry = {
      id: 'lt-MeleeGrunt', catalogId: 'loot-tables', name: 'LT_Grunt',
      categoryPath: ['Loot Tables', 'Minion'], tags: ['Melee Grunt'], lifecycle: 'planned',
      data: {
        archetypeId: 'MeleeGrunt', archetypeName: 'Melee Grunt', color: '#0f0', icon: 'FG',
        lootTableName: 'LT_Grunt', dropChance: 0.3, rarityWeights: [60, 25, 10, 4, 1], bonusGold: 15,
      },
    };
    const p = r!.buildStepPrompt(lt, 'author-python', ctx);
    expect(p).toContain('UARPGLootTable');
    expect(p).toContain('LT_Grunt');
  });
});
