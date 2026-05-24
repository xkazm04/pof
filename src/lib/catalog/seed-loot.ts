import {
  DEFAULT_ENEMY_LOOT_BINDINGS,
  type EnemyLootBinding,
} from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';
import type { LootTableEntry } from './types';

/** Bucket a drop chance into a difficulty tier for the L4 taxonomy. */
function tierOf(dropChance: number): string {
  if (dropChance >= 1) return 'Boss';
  if (dropChance >= 0.5) return 'Elite';
  if (dropChance >= 0.32) return 'Standard';
  return 'Minion';
}

/** Convert one enemy→loot binding into a catalog LootTableEntry. */
export function lootBindingToEntry(binding: EnemyLootBinding): LootTableEntry {
  return {
    id: `lt-${binding.archetypeId}`,
    catalogId: 'loot-tables',
    name: binding.lootTableName,
    categoryPath: ['Loot Tables', tierOf(binding.dropChance)],
    tags: [binding.archetypeName],
    lifecycle: 'planned',
    data: binding,
  };
}

/** Seed the loot-tables catalog from the existing enemy→loot bindings. */
export function seedLootEntries(): LootTableEntry[] {
  return DEFAULT_ENEMY_LOOT_BINDINGS.map(lootBindingToEntry);
}
