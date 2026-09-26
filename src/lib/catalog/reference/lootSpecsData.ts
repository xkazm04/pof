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
    body: 'Ordinary monster selection admits available rows with positive drop weight whose minimum monster level is no greater than the monster’s difficulty-adjusted level, then uses drop weight as relative probability. Hero class is not a filter. Other random-item selectors give each admitted row equal weight; the named-monster selector excludes gold and non-book miscellaneous items.',
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
    body: 'Generic magic generation requests prefix only with probability 5/24, suffix only with 5/8, and both with 1/6. Eligible affixes match the item kind and the inclusive half-level-to-level band, then use their chance column as relative weight. Ordinary generation restricts selection to useful affixes two-thirds of the time, and opposite good or evil alignments cannot pair.',
    refs: ['items.cpp#L1063-L1094', 'items.cpp#L1174-L1208', 'items.cpp#L1210-L1234'],
  },
  {
    id: 'd1-loot-gold-consumables',
    title: 'Gold and consumables',
    body: 'A gold pile is uniform from five times through one less than fifteen times dungeon level plus its difficulty offset; Hell-themed floors add a truncated eighth before the cap. Potions, scrolls, books, and elixirs otherwise obey base-row gates and weights. Useful object drops choose Mana or Healing equally on the first floor, then Mana, Healing, or Town Portal equally below it.',
    refs: ['items.cpp#L613-L663', 'items.cpp#L1517-L1557', 'items.cpp#L3166-L3186'],
  },
  {
    id: 'd1-loot-healing-potions',
    title: 'Healing-potion restoration',
    body: 'Using a Healing potion restores floor(maximum whole life / 8) plus a uniform integer from zero through floor(maximum whole life / 4) - 1, then Warriors double it, Rogues add one half, and Sorcerers keep it. Restoration is capped at maximum life. A Full Healing potion instead restores life directly to maximum.',
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
