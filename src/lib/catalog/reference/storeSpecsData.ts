/** Diablo I town services transcribed from the pinned engine source, not from its data tables. */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { StoreLawData, StoreSpecData } from '@/lib/catalog/reference/storeSpecs';

type SourceReference = `.reference/devilutionX/Source/${string}`;

const pinned = (reference: SourceReference): string =>
  `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${reference.slice('.reference/devilutionX/Source/'.length)}`;
const refs = (...references: SourceReference[]) => references.map(pinned);

export const STORE_SPECS_DATA: readonly StoreSpecData[] = [
  {
    id: 'griswold-basic', towner: 'Griswold', npcId: 'TOWN_SMITH', kind: 'shop',
    stock: 'Vanilla single-player stocks 10–19 identified normal weapons, bows, shields, helms, and armour. It excludes miscellaneous items, gold, staves, rings, and amulets. Base minimum levels run from zero through a stock level based on the deepest visited dungeon level, and value is capped at 140,000 gold.',
    restock: 'The entire list is cleared and rerolled whenever town loads. A purchase erases its item until a later town load; gaining a character level alone does not run store setup.',
    buyPrice: 'The player pays exactly the generated item’s identified engine value, with no markup or reputation adjustment.',
    sellPrice: 'Griswold pays a quarter of the item’s value, rounded down, at least 1 gold. Identified magic uses identified value; everything else uses base value. The sold item is destroyed rather than stocked.',
    otherCosts: 'There is no trade fee. Vanilla gold piles hold at most 5,000, and a sale is refused when its payment cannot fit the available piles, including cells freed by the sold item.',
    restrictions: 'He rejects empty items, ordinary miscellaneous items, gold, staves, quest-class items, and Lazarus’s staff. Only inventory and belt are scanned, not equipped gear. Rings and amulets are accepted even though he does not stock them.',
    hellfireDelta: 'Oils are accepted. The staff predicate instead rejects staves carrying a valid spell.',
    refs: refs('.reference/devilutionX/Source/items.cpp:1869-1900', '.reference/devilutionX/Source/items.cpp:4396-4426', '.reference/devilutionX/Source/stores.cpp:543-606', '.reference/devilutionX/Source/stores.cpp:1334-1342', '.reference/devilutionX/Source/stores.cpp:1414-1476', '.reference/devilutionX/Source/stores.cpp:2162-2180', '.reference/devilutionX/Source/stores.cpp:2866-2885', '.reference/devilutionX/Source/items.h:30-39', '.reference/devilutionX/Source/stores.h:27-31', '.reference/devilutionX/Source/diablo.cpp:3120-3126'),
  },
  {
    id: 'griswold-premium', towner: 'Griswold', npcId: 'TOWN_SMITH', kind: 'premium-shop',
    stock: 'Vanilla single-player stocks six identified items made with good-only affix rolls. Bases exclude miscellaneous items, gold, and staves but may include jewellery. Slot levels range from one below the character level through two above it, clamped to levels 1–30. Value is capped at 140,000 gold.',
    restock: 'Stock persists across ordinary town reloads. After character-level gains, the next town setup advances once per gained level, rotates older stock, and creates two items. A purchased item is replaced immediately at that slot’s character-level offset.',
    buyPrice: 'The player pays exactly the generated item’s identified engine value after affixes, with no additional markup.',
    sellPrice: 'There is no premium resale channel. Selling to Griswold uses his basic-store quarter-value rule and never adds the item to premium stock.',
    otherCosts: 'There is no additional fee.',
    restrictions: 'Griswold’s ordinary resale restrictions apply.',
    hellfireDelta: 'There are 15 slots: three one level below, four at level, four one above, two two above, and two three above. Three items are created per level, the cap is 200,000, staves are allowed, extra attribute and same-category value filters apply, and generation stops after 150 attempts.',
    refs: refs('.reference/devilutionX/Source/items.cpp:367-395', '.reference/devilutionX/Source/items.cpp:1911-2008', '.reference/devilutionX/Source/items.cpp:4429-4464', '.reference/devilutionX/Source/stores.cpp:1372-1411', '.reference/devilutionX/Source/stores.h:30-31'),
  },
  {
    id: 'griswold-repair', towner: 'Griswold', npcId: 'TOWN_SMITH', kind: 'repair',
    stock: 'There is no merchandise. Damaged equipped head, chest, and hand items are candidates. Carried items must be nonempty, damaged, destructible, and neither miscellaneous items nor gold.',
    restock: 'The candidate list is rebuilt from current equipment and inventory whenever repair opens.',
    buyPrice: 'Not applicable.', sellPrice: 'Not applicable.',
    otherCosts: 'For identified magic, multiply 30 by identified value and missing durability, divide by maximum durability, then by 100 and by 2 with integer rounding down; zero-cost results are omitted. Other eligible gear costs half its base value scaled by missing durability, rounded down, at least 1 gold. Payment fully repairs it.',
    restrictions: 'Full-durability and indestructible items cannot be repaired. Carried miscellaneous items and gold are excluded.',
    hellfireDelta: null,
    refs: refs('.reference/devilutionX/Source/stores.cpp:610-687', '.reference/devilutionX/Source/stores.cpp:1480-1505', '.reference/devilutionX/Source/stores.cpp:2121-2142'),
  },
  {
    id: 'adria-shop', towner: 'Adria', npcId: 'TOWN_WITCH', kind: 'shop',
    stock: 'Vanilla single-player stocks 10–17 items. Mana potion, full-mana potion, and town portal occupy permanent slots. Remaining bases are eligible miscellaneous items or staves. Staves receive good-only bonuses. Health potions, oils, and single-player-invalid Resurrect and Heal Other stock are excluded. Value is capped at 140,000 gold.',
    restock: 'The list rerolls whenever town loads. Buying from a permanent slot advances its seed without removing it. Other purchases erase their entries until the next town load.',
    buyPrice: 'The player pays exactly the generated item’s identified engine value, with no markup or reputation adjustment.',
    sellPrice: 'Adria pays a quarter of the item’s value, rounded down, at least 1 gold. Identified magic uses identified value; everything else uses base value. The sold item is destroyed rather than stocked.',
    otherCosts: 'There is no trade fee.',
    restrictions: 'She buys only miscellaneous items and, in vanilla, staves. Oils, quest-class items, the quest identifier range, Lazarus’s staff, weapons, armour, jewellery, and gold are rejected. Only inventory and belt are scanned.',
    hellfireDelta: 'Stock rises to 10–24 items with a 200,000 cap, and up to three eligible early books may use the next four finite slots. Only staves carrying valid spells are accepted for resale.',
    refs: refs('.reference/devilutionX/Source/items.cpp:2010-2037', '.reference/devilutionX/Source/items.cpp:4467-4531', '.reference/devilutionX/Source/stores.cpp:768-833', '.reference/devilutionX/Source/stores.cpp:1580-1645', '.reference/devilutionX/Source/stores.cpp:2888-2908', '.reference/devilutionX/Source/stores.h:38-40'),
  },
  {
    id: 'adria-recharge', towner: 'Adria', npcId: 'TOWN_WITCH', kind: 'recharge',
    stock: 'There is no merchandise; candidates are copied from the hero’s charged items.',
    restock: 'The candidate list is rebuilt whenever recharge opens.',
    buyPrice: 'Not applicable.', sellPrice: 'Not applicable.',
    otherCosts: 'Add base value and the staff spell cost, multiply by missing charges, divide by maximum charges, then divide by 2 using the engine’s left-to-right integer rounding. There is no minimum charge. Payment restores maximum charges.',
    restrictions: 'Eligible equipped gear is a left-hand staff or unique charged item below maximum. Inventory accepts staves and items marked unique or staff when they have missing charges.',
    hellfireDelta: null,
    refs: refs('.reference/devilutionX/Source/stores.cpp:836-905', '.reference/devilutionX/Source/stores.cpp:1648-1668'),
  },
  {
    id: 'pepin-shop', towner: 'Pepin', npcId: 'TOWN_HEALER', kind: 'shop',
    stock: 'Vanilla single-player stocks 10–17 normal miscellaneous items. Healing and full-healing potions occupy permanent slots. Random stock is limited to Healing scrolls, four attribute elixirs, rejuvenation potions, and full-rejuvenation potions. Random entries are identified and this generator has no vendor-value cap.',
    restock: 'The list rerolls whenever town loads. Buying from either permanent slot advances its seed without removing it. Other purchases erase their entries until the next town load.',
    buyPrice: 'The player pays exactly the generated item’s identified engine value, with no markup.',
    sellPrice: 'Pepin does not buy items.', otherCosts: 'There is no item-purchase fee.',
    restrictions: 'The hero cannot sell anything to Pepin.',
    hellfireDelta: 'Stock rises to 10–19 items. An attribute elixir is eligible only while that base attribute remains below the class maximum.',
    refs: refs('.reference/devilutionX/Source/items.cpp:2044-2076', '.reference/devilutionX/Source/items.cpp:4649-4677', '.reference/devilutionX/Source/stores.cpp:1030-1070', '.reference/devilutionX/Source/stores.cpp:1735-1763', '.reference/devilutionX/Source/stores.h:33-36'),
  },
  {
    id: 'pepin-healing', towner: 'Pepin', npcId: 'TOWN_HEALER', kind: 'healing',
    stock: 'No stock is consumed.', restock: 'Not applicable.', buyPrice: 'Free.',
    sellPrice: 'Pepin does not buy items.',
    otherCosts: 'Opening the healer service restores current and base life to their respective maxima without taking gold.',
    restrictions: 'Healing restores life but not mana. An earlier matching quest handler can end the conversation before the healer store opens, so that interaction does not reach free healing.',
    hellfireDelta: null,
    refs: refs('.reference/devilutionX/Source/stores.cpp:1018-1043', '.reference/devilutionX/Source/towners.cpp:413-448'),
  },
  {
    id: 'wirt-inspection', towner: 'Wirt', npcId: 'TOWN_PEGBOY', kind: 'inspection-shop',
    stock: 'Vanilla single-player offers one identified item. Its base excludes miscellaneous items, gold, and staves; rings and amulets are eligible. Base and good-only affix levels follow character level. The value before Wirt’s price adjustment is capped at 90,000 gold.',
    restock: 'The item remains while half the character level, rounded down, has not increased. It rerolls on the next town setup after that value rises or after the slot was emptied by purchase; it is not replaced immediately.',
    buyPrice: 'After inspection, the vanilla price is the item’s value plus half that value rounded down.',
    sellPrice: 'Wirt does not buy items.',
    otherCosts: 'Each inspection costs 50 gold before the item is shown. The fee is separate from the purchase and is not credited toward it.',
    restrictions: 'The hero cannot sell anything to Wirt.',
    hellfireDelta: 'The purchase price is the item’s value minus a quarter rounded down. The item cap rises to 200,000, with class, type, attribute, and at-least-four-fifths-of-best-same-category value filters plus bounded retries.',
    refs: refs('.reference/devilutionX/Source/items.cpp:1911-1935', '.reference/devilutionX/Source/items.cpp:2039-2042', '.reference/devilutionX/Source/items.cpp:4533-4646', '.reference/devilutionX/Source/stores.cpp:971-1006', '.reference/devilutionX/Source/stores.cpp:1694-1733', '.reference/devilutionX/Source/stores.cpp:1766-1794', '.reference/devilutionX/Source/items.h:36-39'),
  },
  {
    id: 'cain-identify', towner: 'Cain', npcId: 'TOWN_STORY', kind: 'identify',
    stock: 'There is no merchandise. Candidates are unidentified non-normal items in all seven equipment slots and inventory; belt items are not scanned.',
    restock: 'The candidate list is rebuilt whenever identification opens.',
    buyPrice: 'Not applicable.', sellPrice: 'Cain does not buy items.',
    otherCosts: 'Identification costs exactly 100 gold per item. Payment marks the selected item identified and recalculates the hero’s inventory effects.',
    restrictions: 'Normal-quality and already identified items cannot be submitted. The hero cannot sell anything to Cain.',
    hellfireDelta: null,
    refs: refs('.reference/devilutionX/Source/stores.cpp:1072-1102', '.reference/devilutionX/Source/stores.cpp:1104-1187', '.reference/devilutionX/Source/stores.cpp:1797-1823'),
  },
];

export const STORE_LAWS_DATA: readonly StoreLawData[] = [
  {
    id: 'd1-store-pricing-law', title: 'Engine pricing',
    body: 'Ordinary shops charge the item’s identified engine value. Wirt first charges 50 gold to look, then charges the value plus half, rounded down; Hellfire instead subtracts a quarter, rounded down. Griswold and Adria pay a quarter of item value, rounded down, at least 1 gold. Vanilla item caps are 140,000, or 90,000 before Wirt’s adjustment; Hellfire caps them at 200,000. Vanilla gold piles hold at most 5,000.',
    refs: refs('.reference/devilutionX/Source/stores.cpp:543-583', '.reference/devilutionX/Source/stores.cpp:1334-1383', '.reference/devilutionX/Source/stores.cpp:1694-1709', '.reference/devilutionX/Source/stores.cpp:1766-1794', '.reference/devilutionX/Source/items.h:30-39'),
  },
  {
    id: 'd1-store-stock-law', title: 'Engine stock lifecycle',
    body: 'Basic, witch, and healer stock rerolls whenever town loads. In single-player, their stock level is the deepest visited dungeon level plus two, kept between 6 and 16. Premium stock advances after character-level gains when town setup next runs; Wirt does the same when half the character level, rounded down, increases. Permanent consumables are not removed on purchase.',
    refs: refs('.reference/devilutionX/Source/diablo.cpp:3120-3126', '.reference/devilutionX/Source/diablo.cpp:3398-3429', '.reference/devilutionX/Source/stores.cpp:2162-2180', '.reference/devilutionX/Source/items.cpp:4436-4464', '.reference/devilutionX/Source/items.cpp:4533-4558', '.reference/devilutionX/Source/player.cpp:2384-2404'),
  },
  {
    id: 'd1-store-service-fees-law', title: 'Repair, recharge, and identification',
    body: 'Identified magic repair multiplies 30 by identified value and missing durability, then divides by maximum durability, 100, and 2 with integer rounding; zero is omitted. Other repairs cost half base value scaled by missing durability, rounded down, at least 1 gold. Recharge halves base value plus spell cost after scaling by missing charges. Cain charges 100 gold.',
    refs: refs('.reference/devilutionX/Source/stores.cpp:851-856', '.reference/devilutionX/Source/stores.cpp:1095-1101', '.reference/devilutionX/Source/stores.cpp:2121-2142'),
  },
  {
    id: 'd1-store-overview-law', title: 'No metagame commerce layer',
    body: 'Prices come directly from item and service formulas, with no faction or reputation input. Selling destroys the player’s item and creates only gold, so there is no vendor buyback inventory. Only Griswold and Adria buy from the player, and each accepts different item categories.',
    refs: refs('.reference/devilutionX/Source/stores.cpp:1334-1383', '.reference/devilutionX/Source/stores.cpp:1431-1454', '.reference/devilutionX/Source/stores.cpp:2866-2908'),
  },
];

/** Laws live beside the data so the canon imports them without a cycle through the seeding module. */
export const DIABLO1_STORE_LAWS: readonly ProjectRule[] = STORE_LAWS_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game',
  scope: 'vendors',
  title: `${law.title} (engine-derived)`,
  refs: [...law.refs],
}));
