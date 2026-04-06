/* ── Entity Metadata Schema ────────────────────────────────────────────────── */
/* Foundation for ScalableSelector group-by (Phase 2).                        */
/* Provides a uniform metadata shape for characters, items, abilities,        */
/* enemies, and zones so they can be grouped/filtered by any field.           */

/* ── Core types ───────────────────────────────────────────────────────────── */

export interface EntityMetadata {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  tags: string[];
  level?: number;
  levelMax?: number;
  area?: string;
  tier?: string;
  icon?: string;
}

/** Describes how to group a list of EntityMetadata items. */
export interface EntityGrouping {
  field: keyof EntityMetadata;
  label: string;
  /** Explicit sort order for the groups (alphabetical if omitted). */
  order?: string[];
}

/* ── Default grouping presets ─────────────────────────────────────────────── */

export const CHAR_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Class', order: ['Force-user', 'Warrior', 'Mage', 'Rogue', 'Tank', 'Support', 'Beast', 'Droid'] },
  { field: 'area', label: 'Area', order: ['Taris', 'Dantooine', 'Kashyyyk', 'Korriban', 'Manaan'] },
  { field: 'tier', label: 'Tier', order: ['common', 'elite', 'boss', 'legendary'] },
  { field: 'subcategory', label: 'Role' },
];

export const ITEM_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Type', order: ['Weapon', 'Armor', 'Accessory', 'Consumable', 'Quest', 'Material'] },
  { field: 'tier', label: 'Rarity', order: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] },
  { field: 'subcategory', label: 'Subtype' },
];

export const ABILITY_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Category', order: ['Melee', 'Force', 'Ranged', 'Defensive'] },
  { field: 'subcategory', label: 'Element', order: ['Physical', 'Fire', 'Lightning', 'Ice'] },
];

export const ENEMY_GROUPINGS: EntityGrouping[] = [
  { field: 'area', label: 'Area' },
  { field: 'tier', label: 'Tier', order: ['Minion', 'Standard', 'Elite', 'Boss', 'Raid-Boss'] },
  { field: 'category', label: 'Category', order: ['Humanoid', 'Beast', 'Droid', 'Force-sensitive', 'Undead'] },
];

export const ZONE_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Zone Type', order: ['Hub', 'Combat', 'Boss'] },
  { field: 'tier', label: 'Difficulty', order: ['Starter', 'Mid', 'High', 'Endgame'] },
];

export const LOOT_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Item Type', order: ['Weapon', 'Armor', 'Consumable', 'Accessory'] },
  { field: 'tier', label: 'Rarity', order: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] },
];

/* ── Grouping utility (Phase 2 ScalableSelector foundation) ──────────────── */

export interface EntityGroup {
  key: string;
  items: EntityMetadata[];
}

/**
 * Group entities by a single EntityGrouping descriptor.
 * For array fields (tags), an entity appears in every matching group.
 * Groups are sorted by `order` if provided, otherwise alphabetically.
 * Items with no value for the field land in an "Ungrouped" bucket.
 */
export function groupEntities(
  items: EntityMetadata[],
  grouping: EntityGrouping,
): EntityGroup[] {
  const map = new Map<string, EntityMetadata[]>();

  for (const item of items) {
    const raw = item[grouping.field];
    const keys: string[] =
      raw == null ? [] :
      Array.isArray(raw) ? raw :
      [String(raw)];

    if (keys.length === 0) {
      const bucket = map.get('Ungrouped') ?? [];
      bucket.push(item);
      map.set('Ungrouped', bucket);
    } else {
      for (const k of keys) {
        const bucket = map.get(k) ?? [];
        bucket.push(item);
        map.set(k, bucket);
      }
    }
  }

  const groups = Array.from(map, ([key, groupItems]) => ({ key, items: groupItems }));

  if (grouping.order) {
    const orderIndex = new Map(grouping.order.map((k, i) => [k, i]));
    groups.sort((a, b) => {
      if (a.key === 'Ungrouped') return 1;
      if (b.key === 'Ungrouped') return -1;
      const ai = orderIndex.get(a.key) ?? Infinity;
      const bi = orderIndex.get(b.key) ?? Infinity;
      return ai - bi || a.key.localeCompare(b.key);
    });
  } else {
    groups.sort((a, b) => {
      if (a.key === 'Ungrouped') return 1;
      if (b.key === 'Ungrouped') return -1;
      return a.key.localeCompare(b.key);
    });
  }

  return groups;
}
