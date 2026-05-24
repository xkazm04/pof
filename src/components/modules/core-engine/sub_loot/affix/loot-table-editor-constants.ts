import type { LootSource } from '../_shared/data';

export const LOOT_TABLE_EDITOR_PAGE_SIZE = 20;

export const LOOT_SOURCE_LABELS: Record<LootSource, string> = {
  enemy: 'Enemy Drops',
  chest: 'Chest / Container',
  quest: 'Quest Rewards',
  crafting: 'Crafting Materials',
};
