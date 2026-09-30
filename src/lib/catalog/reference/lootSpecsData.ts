import type { ProjectRule } from '@/lib/catalog/canon/types';

interface LootLawData {
  id: `d1-loot-${string}`;
  title: string;
  body: string;
  refs: readonly `${string}#L${number}-L${number}`[];
}

const source = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/';

/** Engine-derived loot laws. This table contains procedure, never source-table row values. */
export const LOOT_LAW_DATA = [
  {
    id: 'd1-loot-drop-outcome',
    title: 'Monster drop outcome',
    body: 'An ordinary eligible kill has a nominal 59% chance to drop nothing, a 30.34% chance to create gold directly, and a 10.66% chance to select from the eligible base-item pool. A no-drop treasure flag suppresses this path. Named monsters and scripted bosses use separate procedures, and a full item limit can suppress any result.',
    refs: ['items.cpp#L3256-L3266', 'items.cpp#L3422-L3475', 'monster.cpp#L911-L944'],
  },
  {
    id: 'd1-loot-base-selection',
    title: 'Base-item selection',
    body: 'Ordinary monster selection admits available positive-weight rows at or below the monster’s difficulty-adjusted level and uses drop weight relatively; single-player also rejects Resurrect and Heal Other rows. Hero class is not a filter. Other random-item selectors give each admitted row equal weight; the named-monster selector excludes gold and non-book miscellaneous items.',
    refs: ['items.cpp#L1353-L1414', 'items.cpp#L2373-L2400', 'tables/itemdat.cpp#L568-L600'],
  },
  {
    id: 'd1-loot-quality',
    title: 'Item quality',
    body: 'A selected base starts Normal. Bonus generation opens on an 11% roll, otherwise on a second level-scaled roll; good-only sources and staves, rings, and amulets always open it. A compatible Unique then has a nominal 2% chance, or 16% from a named monster. Otherwise successful affixes make the item Magic. Diablo has no Rare quality.',
    refs: ['items.cpp#L1417-L1449', 'items.cpp#L1481-L1492', 'items.cpp#L3269-L3303'],
  },
  {
    id: 'd1-loot-affixes',
    title: 'Magic-affix selection',
    body: 'Generic magic generation requests prefix only with probability 5/24, suffix only with 5/8, and both with 1/6. For ordinary rolls, eligible affixes match item kind and the inclusive half-level-to-level band, weighted by chance; other callers pass different bands, and GetItemBonus caps the lower bound at 25. Ordinary generation restricts selection to useful affixes two-thirds of the time, and opposite good or evil alignments cannot pair.',
    refs: ['items.cpp#L1063-L1094', 'items.cpp#L1174-L1208', 'items.cpp#L1210-L1234'],
  },
  {
    id: 'd1-loot-gold-consumables',
    title: 'Gold and consumables',
    body: 'A gold pile is uniform from five times through one less than fifteen times dungeon level plus its difficulty offset; Hell-themed floors add a truncated eighth before the cap. Ordinary monster consumables obey base-row gates and weights. Vanilla useful drops are 1/2 Mana and 1/2 Healing on floor 1, then 1/3 each Mana/Healing/Portal. Hellfire uses 3/7 Healing, 3/7 Mana, 1/7 Oil on floor 1, then 2/7 Healing, 2/7 Mana, 2/7 Portal, 1/7 Oil.',
    refs: ['items.cpp#L613-L663', 'items.cpp#L1517-L1557', 'items.cpp#L3166-L3186'],
  },
  {
    id: 'd1-loot-healing-potions',
    title: 'Healing-potion restoration',
    body: 'Using a Healing potion restores floor(maximum whole life / 8) plus a uniform integer from zero through floor(maximum whole life / 4) - 1; Warriors and Barbarians double it, Rogues, Monks, and Bards add one half, and other classes keep it. Restoration is capped at maximum life. A Full Healing potion instead restores life directly to maximum.',
    refs: ['items.cpp#L4206-L4223', 'player.cpp#L1744-L1756', 'player.h#L719-L724'],
  },
] as const satisfies readonly LootLawData[];

export const DIABLO1_LOOT_LAWS: readonly ProjectRule[] = LOOT_LAW_DATA.map((law) => ({
  id: law.id,
  profile: 'diablo1',
  category: 'game',
  scope: 'items',
  title: `${law.title} (engine-derived)`,
  body: law.body,
  refs: law.refs.map((ref) => `${source}${ref}`),
}));
