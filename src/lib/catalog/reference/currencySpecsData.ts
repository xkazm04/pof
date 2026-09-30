/** Engine-derived Diablo I currency rules. No reference-table rows are copied here. */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { CurrencyLawData, CurrencySpecData } from '@/lib/catalog/reference/currencySpecs';

type SourceReference = `.reference/devilutionX/Source/${string}`;

const pinned = (reference: SourceReference): string => {
  const path = reference.slice('.reference/devilutionX/Source/'.length);
  const match = /^(.*):(\d+)(?:-(\d+))?$/.exec(path);
  if (!match) return `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${path}`;
  return `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${match[1]}#L${match[2]}${match[3] ? `-L${match[3]}` : ''}`;
};

const refs = (...references: SourceReference[]) => references.map(pinned);

export const CURRENCY_SPECS_DATA = [
  {
    id: 'd1-currency-gold',
    name: 'Gold',
    itemId: 'IDI_GOLD',
    itemType: 'ItemType::Gold',
    totalField: 'Player::_pGold',
    storage: {
      kind: 'inventory-piles',
      pileCapConstant: 'GOLD_MAX_LIMIT',
      carryCapFormula: 'sum of room remaining in existing gold piles plus GOLD_MAX_LIMIT for each empty inventory cell',
      totalFormula: 'Player::_pGold = sum(InvList[i]._ivalue where InvList[i]._itype == ItemType::Gold)',
      refs: refs(
        '.reference/devilutionX/Source/items.h:30-30',
        '.reference/devilutionX/Source/player.h:267-267',
        '.reference/devilutionX/Source/inv.cpp:1484-1505',
        '.reference/devilutionX/Source/inv.cpp:2280-2289',
      ),
    },
    pickup: {
      mergeRule: 'Top off non-full inventory piles in InvList order, then create one-cell piles in empty inventory cells. Auto-pickup leaves any remainder on the world item when capacity is exhausted; manual pickup moves the remainder to the held item and removes the world item.',
      placementOrder: 'Empty cells are filled across the last inventory row from right to left, then by columns from bottom to top and right to left.',
      splitRule: 'Using a gold pile opens a bounded numeric dialog; the chosen amount is removed from that pile, becomes the held gold item, and _pGold is recalculated.',
      displayRule: 'Pile cursor size follows GetGoldCursor(_ivalue); inventory hover text pluralizes the pile value, while stores render TotalPlayerGold().',
      refs: refs(
        '.reference/devilutionX/Source/items.cpp:2975-2989',
        '.reference/devilutionX/Source/inv.cpp:1087-1124',
        '.reference/devilutionX/Source/inv.cpp:1507-1550',
        '.reference/devilutionX/Source/inv.cpp:1672-1686',
        '.reference/devilutionX/Source/control/control_gold.cpp:18-113',
        '.reference/devilutionX/Source/stores.cpp:2459-2475',
      ),
    },
    faucets: [
      {
        id: 'monster-drop',
        formula: 'Five times difficulty-adjusted dungeon level plus GenerateRnd of ten times that level; Hell dungeon tiles add one eighth, then GOLD_MAX_LIMIT caps the pile.',
        lawId: 'd1-loot-gold-consumables',
        refs: refs('.reference/devilutionX/Source/items.cpp:3166-3186'),
      },
      {
        id: 'item-sale',
        formula: 'Griswold or Adria pays max(selected item value / 4, 1), using identified value for identified magic and base value otherwise; the sold item is removed before gold is placed.',
        lawId: 'd1-store-pricing-law',
        refs: refs(
          '.reference/devilutionX/Source/stores.cpp:543-583',
          '.reference/devilutionX/Source/stores.cpp:768-808',
          '.reference/devilutionX/Source/stores.cpp:1414-1454',
        ),
      },
    ],
    questRewards: {
      present: false,
      rule: 'Vanilla quest rewards are items, spell progress, stat changes, or access changes; no quest completion handler directly grants an IDI_GOLD pile or increments _pGold.',
      refs: refs(
        '.reference/devilutionX/Source/quests.cpp:175-285',
        '.reference/devilutionX/Source/towners.cpp:219-478',
        '.reference/devilutionX/Source/monster.cpp:875-944',
      ),
    },
    sinks: [
      {
        id: 'vendor-purchase',
        formula: 'Ordinary purchases debit item._iIvalue; Wirt also debits his inspection fee and prices the vanilla item at value plus half value, rounded down.',
        lawId: 'd1-store-pricing-law',
        refs: refs(
          '.reference/devilutionX/Source/stores.cpp:1334-1383',
          '.reference/devilutionX/Source/stores.cpp:1694-1709',
          '.reference/devilutionX/Source/stores.cpp:1725-1753',
          '.reference/devilutionX/Source/stores.cpp:1766-1794',
        ),
      },
      {
        id: 'repair',
        formula: 'Identified magic: 30 * identified value * missing durability / maximum durability / 100 / 2, omitting zero; otherwise max(base value * missing durability / maximum durability / 2, 1).',
        lawId: 'd1-store-service-fees-law',
        refs: refs(
          '.reference/devilutionX/Source/stores.cpp:1480-1505',
          '.reference/devilutionX/Source/stores.cpp:2121-2142',
        ),
      },
      {
        id: 'recharge',
        formula: '(base value + staff spell cost) * missing charges / maximum charges / 2 with integer rounding; payment restores maximum charges.',
        lawId: 'd1-store-service-fees-law',
        refs: refs(
          '.reference/devilutionX/Source/stores.cpp:851-856',
          '.reference/devilutionX/Source/stores.cpp:1648-1668',
        ),
      },
      {
        id: 'identify',
        formula: 'Cain assigns the fixed identification charge to each eligible item; payment marks the selected item identified.',
        lawId: 'd1-store-service-fees-law',
        refs: refs(
          '.reference/devilutionX/Source/stores.cpp:1095-1101',
          '.reference/devilutionX/Source/stores.cpp:1797-1823',
        ),
      },
    ],
    settlement: {
      formula: 'TakePlrsMoney subtracts the cost from Player::_pGold, removes partial piles before full piles, and updates each changed pile cursor.',
      refs: refs(
        '.reference/devilutionX/Source/stores.cpp:2062-2081',
        '.reference/devilutionX/Source/stores.cpp:2658-2671',
      ),
    },
    portOnly: [
      {
        feature: 'DevilutionX shared stash gold',
        rule: 'The pinned port adds Stash.gold to the store-visible balance and spends inventory gold before stash gold. Vanilla Diablo I has no stash, so it is excluded from this entity’s storage and carry-cap model.',
        refs: refs(
          '.reference/devilutionX/Source/qol/stash.h:19-30',
          '.reference/devilutionX/Source/stores.cpp:459-462',
          '.reference/devilutionX/Source/stores.cpp:2658-2671',
        ),
      },
    ],
  },
] as const satisfies readonly CurrencySpecData[];

export const CURRENCY_LAWS_DATA = [
  {
    id: 'd1-gold-pile-law',
    title: 'Gold piles and inventory accounting',
    body: 'Vanilla gold is an inventory item stored in one-cell piles capped by GOLD_MAX_LIMIT. Both pickup paths fill existing piles before creating new ones; auto-pickup leaves a residual world pile when capacity runs out, while manual pickup moves that residual to the held item. Player::_pGold is the sum of carried piles. Splitting a pile moves the chosen bounded amount to the held item and recalculates that sum.',
    refs: refs(
      '.reference/devilutionX/Source/items.h:30-30',
      '.reference/devilutionX/Source/inv.cpp:1087-1124',
      '.reference/devilutionX/Source/inv.cpp:1507-1550',
      '.reference/devilutionX/Source/inv.cpp:2280-2289',
      '.reference/devilutionX/Source/control/control_gold.cpp:18-113',
    ),
  },
] as const satisfies readonly CurrencyLawData[];

/** Laws live beside the data so the canon imports them without a cycle through the seeding module. */
export const DIABLO1_CURRENCY_LAWS: readonly ProjectRule[] = CURRENCY_LAWS_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game',
  scope: 'currencies',
  title: `${law.title} (engine-derived)`,
  refs: [...law.refs],
}));
