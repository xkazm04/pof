/** Diablo I gold derived from pinned engine procedures rather than reference-table rows. */
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { CURRENCY_SPECS_DATA, DIABLO1_CURRENCY_LAWS } from '@/lib/catalog/reference/currencySpecsData';

export interface CurrencyFlowData {
  id: string;
  formula: string;
  lawId: string;
  refs: readonly string[];
}

export interface CurrencyLawData {
  id: `d1-gold-${string}-law`;
  title: string;
  body: string;
  refs: readonly string[];
}

export interface CurrencySpecData {
  id: 'd1-currency-gold';
  name: 'Gold';
  itemId: 'IDI_GOLD';
  itemType: 'ItemType::Gold';
  totalField: 'Player::_pGold';
  storage: {
    kind: 'inventory-piles';
    pileCapConstant: 'GOLD_MAX_LIMIT';
    carryCapFormula: string;
    totalFormula: string;
    refs: readonly string[];
  };
  pickup: {
    mergeRule: string;
    placementOrder: string;
    splitRule: string;
    displayRule: string;
    refs: readonly string[];
  };
  faucets: readonly CurrencyFlowData[];
  questRewards: { present: false; rule: string; refs: readonly string[] };
  sinks: readonly CurrencyFlowData[];
  settlement: { formula: string; refs: readonly string[] };
  portOnly: readonly { feature: string; rule: string; refs: readonly string[] }[];
}

export type CurrencySpec = CurrencySpecData;
export const CURRENCY_SPECS: readonly CurrencySpec[] = CURRENCY_SPECS_DATA;

export { DIABLO1_CURRENCY_LAWS };

export type CurrencyCatalogEntity = IngestedEntity;
export interface CurrencyEntityWrapper { catalogId: 'currencies'; entity: CurrencyCatalogEntity }

const allRefs = (spec: CurrencySpec): string[] => [
  ...spec.storage.refs,
  ...spec.pickup.refs,
  ...spec.faucets.flatMap((flow) => flow.refs),
  ...spec.questRewards.refs,
  ...spec.sinks.flatMap((flow) => flow.refs),
  ...spec.settlement.refs,
  ...spec.portOnly.flatMap((feature) => feature.refs),
];

const engineFiles = (refs: readonly string[]): string => [...new Set(refs.map((ref) => {
  const path = /\/Source\/(.+?)(?:#L\d+(?:-L\d+)?)?$/.exec(ref)?.[1];
  return path ? `engine: Source/${path}` : ref;
}))].join(', ');

export function currencyEntities(): CurrencyEntityWrapper[] {
  return CURRENCY_SPECS.map((spec) => ({
    catalogId: 'currencies',
    entity: {
      id: spec.id,
      catalogId: 'currencies',
      name: spec.name,
      categoryPath: ['Diablo I', 'Economy'],
      tags: ['diablo-currency', 'engine-derived', 'inventory-item'],
      lifecycle: 'planned',
      links: [
        { catalogId: 'vendors', entityId: 'd1-vendor-griswold', role: 'faucet-and-sink' },
        { catalogId: 'vendors', entityId: 'd1-vendor-adria', role: 'faucet-and-sink' },
        { catalogId: 'vendors', entityId: 'd1-vendor-pepin', role: 'sink' },
        { catalogId: 'vendors', entityId: 'd1-vendor-wirt', role: 'sink' },
        { catalogId: 'vendors', entityId: 'd1-vendor-cain', role: 'sink' },
      ],
      data: {
        spec,
        stepGaps: {
          Balance: 'Diablo I defines transaction and drop formulas but no faucet-per-hour, sink-per-hour, or equilibrium target.',
          'Icon 2D Art': 'The engine selects among gold cursor sprites by pile size; it does not provide a generated gallery artifact or selection history.',
          'Test Gate': 'Pinned source states behavior but supplies no PoF.Currency.WalletRules runtime-test result.',
          'UE Packaging': 'The reference engine has no Unreal currency row, wallet component, or packaged UE assets.',
        },
        openQuestions: [
          'Should the PoF-only Balance step be waived for a reference game that states no hourly equilibrium target?',
          'Can inventory piles plus the store total readout satisfy Wallet UI Integration, whose label and contract assume a separate wallet widget?',
          'Should the single-currency Diablo model explicitly waive the pipeline’s premium-currency and exchange-rate assumptions?',
        ],
        portOnly: spec.portOnly,
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1.game,
        sourceProject: DIABLO1.project,
        sourceFile: engineFiles(allRefs(spec)),
        sourceRow: `${spec.itemId} / ${spec.itemType} / ${spec.totalField}`,
        licenceNote: DIABLO1.licenceNote,
        ingestedAt: '2026-09-27T00:00:00.000Z',
        canonProfile: DIABLO1.canonProfile,
      },
    },
  }));
}

function stamp(entity: CurrencyCatalogEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: entity.provenance.sourceFile,
    sourceRow: entity.provenance.sourceRow,
    columns,
  };
}

function specOf(entity: CurrencyCatalogEntity): CurrencySpec | null {
  const spec = entity.data.spec as CurrencySpec | undefined;
  return spec?.id === entity.id ? spec : null;
}

/** Seed only the three currency steps whose checker shapes can represent the engine model. */
export function seedCurrencySteps(entity: CurrencyCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'currencies' || entity.id !== 'd1-currency-gold') return [];
  const spec = specOf(entity);
  if (!spec) return [];

  const brief = `${spec.name} is vanilla Diablo I’s only currency and is also the ${spec.itemId} inventory item. `
    + `It occupies one-cell piles capped by ${spec.storage.pileCapConstant}; pickup first merges into existing non-full piles and then consumes empty inventory cells. `
    + `${spec.totalField} is the sum of carried pile values, not an independent wallet. Monsters create piles through the existing d1-loot-gold-consumables rule, while Griswold and Adria create gold by buying eligible items. `
    + `Buying merchandise and paying for repair, recharge, Wirt’s inspection, or Cain’s identification remove pile values through the store payment path. Vanilla quests grant no gold directly, and DevilutionX stash gold is a port-only extension excluded from this vanilla entity.`;

  return [
    {
      catalogId: 'currencies', entityId: entity.id, step: 'Concept Brief',
      data: {
        brief,
        [SOURCED_FIELD]: stamp(entity, [
          'itemId', 'itemType', 'totalField', 'storage', 'pickup', 'faucets', 'questRewards', 'sinks',
          '(laws d1-gold-pile-law, d1-loot-gold-consumables, d1-store-pricing-law, d1-store-service-fees-law)',
        ]),
      },
      gaps: [],
    },
    {
      catalogId: 'currencies', entityId: entity.id, step: 'Economy Rules',
      data: {
        rules: {
          kind: 'single inventory-item currency',
          faucets: spec.faucets,
          sinks: spec.sinks,
          cap: `${spec.storage.pileCapConstant} per inventory pile; aggregate carry capacity is inventory-space-dependent`,
          conversionNote: 'Vanilla Diablo I has only gold, so there is no premium currency, crafting-orb ledger, or exchange rate.',
          storage: spec.storage,
          pickup: spec.pickup,
          questRewards: spec.questRewards,
          settlement: spec.settlement,
        },
        [SOURCED_FIELD]: stamp(entity, [
          'storage', 'pickup', 'faucets[].formula', 'faucets[].lawId', 'questRewards',
          'sinks[].formula', 'sinks[].lawId', 'settlement',
        ]),
      },
      gaps: [
        'wiringContract: the engine has inventory and store call sites, not the PoF UARPGWalletComponent registration contract assumed by this step',
        'multiple currencies / premium currency / exchange rates: vanilla Diablo I has only gold',
      ],
    },
    {
      catalogId: 'currencies', entityId: entity.id, step: 'Wallet UI Integration',
      data: {
        ui: {
          widget: 'Inventory gold piles and store-panel total; there is no standalone wallet widget.',
          format: 'Inventory hover pluralizes the pile value; stores render “Your gold: {integer}”.',
          position: 'Gold piles occupy inventory-grid cells; the aggregate appears at the upper right of store panels.',
          hudBinding: 'GetItemStr reads each pile’s _ivalue; store drawing calls TotalPlayerGold, which uses Player::_pGold in the vanilla model.',
          wiringContract: {
            grantedBy: 'IDI_GOLD item initialization and the inventory/store panel drawing paths own the two displays.',
            activatedBy: 'Inventory hover reads the pile item; opening or redrawing a store reads the current aggregate gold total.',
            dependencies: ['IDI_GOLD inventory item', 'Player::_pGold carried-pile total'],
            verification: 'L0: inspect GetItemStr and DrawSText/TotalPlayerGold in the pinned engine source.',
          },
        },
        [SOURCED_FIELD]: stamp(entity, ['pickup.displayRule', 'Player::_pGold', 'stores.cpp TotalPlayerGold and DrawSText']),
      },
      gaps: [
        'wallet widget: Diablo I has no separate wallet; whether inventory/store UI satisfies this PoF-named step is an open question',
        'persistent HUD binding: the gold total is rendered in stores, not as an always-visible HUD currency widget',
      ],
    },
  ];
}
