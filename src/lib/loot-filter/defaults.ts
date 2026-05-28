import { RARITY_COLORS } from '@/lib/chart-colors';
import { ALL_ITEM_TYPES } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { AffixAxis, FilterAction, LootFilterRule, LootFilterRuleset } from './types';

/** Authoring option lists for the rule editor. */
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export const ITEM_TYPES: readonly string[] = ALL_ITEM_TYPES;
export const AFFIX_AXES: readonly AffixAxis[] = ['offensive', 'defensive', 'utility'];
export const FILTER_ACTIONS: readonly FilterAction[] = ['show', 'highlight', 'hide'];
export const FILTER_SOUNDS = ['None', 'Chime', 'Alarm', 'Drumroll', 'ShardCrack'] as const;

/** Beam/text colour presets offered in the style picker (keyed off rarity palette). */
export const STYLE_COLOR_PRESETS: readonly string[] = [
  RARITY_COLORS.Common, RARITY_COLORS.Uncommon, RARITY_COLORS.Rare, RARITY_COLORS.Epic, RARITY_COLORS.Legendary,
];

/** A blank Show rule (no constraints) — the seed for "Add rule". */
export function emptyRule(id: string): LootFilterRule {
  return { id, name: 'New Rule', enabled: true, action: 'show', condition: {}, style: {} };
}

const SEED_AT = '2026-05-26T00:00:00.000Z';

/** The starter ruleset shown on first open — a small, representative ARPG filter. */
export function createDefaultRuleset(id = 'default'): LootFilterRuleset {
  return {
    id,
    name: 'Endgame Filter',
    updatedAt: SEED_AT,
    rules: [
      {
        id: `${id}-r1`, name: 'Highlight Legendaries', enabled: true, action: 'highlight',
        condition: { rarities: ['Legendary'] },
        style: { color: RARITY_COLORS.Legendary, sound: 'Drumroll', beam: true },
      },
      {
        id: `${id}-r2`, name: 'Show Epic Gear', enabled: true, action: 'show',
        condition: { rarities: ['Epic'], types: ['Weapon', 'Armor', 'Accessory'] },
        style: { color: RARITY_COLORS.Epic },
      },
      {
        id: `${id}-r3`, name: 'Show Offensive Rares', enabled: true, action: 'show',
        condition: { rarities: ['Rare'], affixAxes: ['offensive'] },
        style: { color: RARITY_COLORS.Rare },
      },
      {
        id: `${id}-r4`, name: 'Hide Common Junk', enabled: true, action: 'hide',
        condition: { rarities: ['Common'], types: ['Material', 'Consumable'] },
        style: {},
      },
    ],
  };
}
