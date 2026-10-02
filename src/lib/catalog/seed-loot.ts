import {
  DEFAULT_ENEMY_LOOT_BINDINGS,
  type EnemyLootBinding,
} from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import { lootTierOf } from '@/lib/loot/economy';
import type { LootTableEntry } from './types';

/** Convert one enemy→loot binding into a catalog LootTableEntry. */
export function lootBindingToEntry(binding: EnemyLootBinding): LootTableEntry {
  return {
    id: `lt-${binding.archetypeId}`,
    catalogId: 'loot-tables',
    name: binding.lootTableName,
    categoryPath: ['Loot Tables', lootTierOf(binding.dropChance)],
    tags: [binding.archetypeName],
    lifecycle: 'planned',
    data: binding,
  };
}

/** Seed the loot-tables catalog from the existing enemy→loot bindings. */
export function seedLootEntries(): LootTableEntry[] {
  return DEFAULT_ENEMY_LOOT_BINDINGS.map(lootBindingToEntry);
}
