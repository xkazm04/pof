/** Diablo I town stores and paid services derived from the pinned engine source. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { STORE_LAWS_DATA, STORE_SPECS_DATA } from '@/lib/catalog/reference/storeSpecsData';

export type StoreKind = 'shop' | 'premium-shop' | 'repair' | 'recharge' | 'healing' | 'inspection-shop' | 'identify';
export type StoreTowner = 'Griswold' | 'Adria' | 'Pepin' | 'Wirt' | 'Cain';
export type StoreNpcId = 'TOWN_SMITH' | 'TOWN_WITCH' | 'TOWN_HEALER' | 'TOWN_PEGBOY' | 'TOWN_STORY';
export type StoreServiceId =
  | 'griswold-basic'
  | 'griswold-premium'
  | 'griswold-repair'
  | 'adria-shop'
  | 'adria-recharge'
  | 'pepin-shop'
  | 'pepin-healing'
  | 'wirt-inspection'
  | 'cain-identify';

export interface StoreSpecData {
  id: StoreServiceId;
  towner: StoreTowner;
  npcId: StoreNpcId;
  kind: StoreKind;
  stock: string;
  restock: string;
  buyPrice: string;
  sellPrice: string;
  otherCosts: string;
  restrictions: string;
  hellfireDelta: string | null;
  refs: readonly string[];
}

export interface StoreLawData {
  id: `d1-store-${string}-law`;
  title: string;
  body: string;
  refs: readonly string[];
}

export const STORE_SPECS: readonly StoreSpecData[] = STORE_SPECS_DATA;

export const DIABLO1_STORE_LAWS: readonly ProjectRule[] = STORE_LAWS_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game',
  scope: 'vendors',
  title: `${law.title} (engine-derived)`,
  refs: [...law.refs],
}));

export type StoreCatalogEntity = IngestedEntity;
export interface StoreEntityWrapper { catalogId: 'vendors'; entity: StoreCatalogEntity }

const TOWNER_SLUG: Readonly<Record<StoreTowner, string>> = {
  Griswold: 'griswold', Adria: 'adria', Pepin: 'pepin', Wirt: 'wirt', Cain: 'cain',
};

export const vendorEntityId = (towner: StoreTowner): string => `d1-vendor-${TOWNER_SLUG[towner]}`;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const engineFiles = (refs: readonly string[]): string => unique(refs.map((ref) => {
  const sourcePath = ref.split('/Source/')[1] ?? ref;
  return `engine: Source/${sourcePath.split(':')[0]}`;
})).join(', ');

/**
 * Cain is deliberately represented here even though he has no merchandise: identification is a
 * paid town service, and a service-only vendor entity gives the character interaction a resolvable
 * vendorBinding without pretending that Cain owns stock.
 */
export function vendorEntities(): StoreEntityWrapper[] {
  const towners = unique(STORE_SPECS.map((spec) => spec.towner));
  return towners.map((towner) => {
    const services = STORE_SPECS.filter((spec) => spec.towner === towner);
    const refs = unique(services.flatMap((service) => service.refs));
    const npcId = services[0].npcId;
    const serviceOnly = towner === 'Cain';
    return {
      catalogId: 'vendors',
      entity: {
        id: vendorEntityId(towner),
        catalogId: 'vendors',
        name: `${towner} — town services`,
        categoryPath: ['Diablo I', serviceOnly ? 'Paid services' : 'Town vendors'],
        tags: ['diablo-town-service', serviceOnly ? 'service-only' : 'merchant'],
        lifecycle: 'planned',
        links: [{ catalogId: 'characters', entityId: `d1-${npcId}`, role: 'host' }],
        data: {
          services,
          classification: serviceOnly
            ? 'Service-only vendor entity: Cain charges for identification but has no merchandise stock.'
            : 'Town merchant with engine-defined merchandise or inspection stock.',
        },
        provenance: {
          kind: 'ingest',
          sourceGame: DIABLO1.game,
          sourceProject: DIABLO1.project,
          sourceFile: engineFiles(refs),
          sourceRow: services.map((service) => service.id).join(', '),
          licenceNote: DIABLO1.licenceNote,
          ingestedAt: '2026-09-26T00:00:00.000Z',
          canonProfile: DIABLO1.canonProfile,
        },
      },
    };
  });
}

function stamp(entity: StoreCatalogEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: entity.provenance.sourceFile,
    sourceRow: entity.provenance.sourceRow,
    columns,
  };
}

function servicesOf(entity: StoreCatalogEntity): StoreSpecData[] {
  return Array.isArray(entity.data.services) ? entity.data.services as StoreSpecData[] : [];
}

const SERVICE_FLAGS: Readonly<Record<StoreTowner, { buy: boolean; sell: boolean; repair: boolean }>> = {
  Griswold: { buy: true, sell: true, repair: true },
  Adria: { buy: true, sell: true, repair: false },
  Pepin: { buy: true, sell: false, repair: false },
  Wirt: { buy: true, sell: false, repair: false },
  Cain: { buy: false, sell: false, repair: false },
};

/** Seed only values the engine states; PoF-only hourly and margin simulation fields remain gaps. */
export function seedVendorSteps(entity: StoreCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'vendors' || !entity.id.startsWith('d1-vendor-')) return [];
  const services = servicesOf(entity);
  if (!services.length) return [];
  const towner = services[0].towner;
  const merchandise = services.filter((service) => ['shop', 'premium-shop', 'inspection-shop'].includes(service.kind));
  const commonGaps = [
    'restockHours: Diablo I restocks on town setup and progression events, not after a fixed number of hours',
    'Economy Sim: the engine states direct prices and fees but no cost basis, target margin, buyer mix, or PoF tier target for the required margin simulation shape',
  ];
  const seeds: StepSeed[] = [];

  if (merchandise.length) {
    seeds.push({
      catalogId: 'vendors', entityId: entity.id, step: 'Inventory Pool',
      data: {
        stock: merchandise.map((service) => `${service.id}: ${service.stock}`),
        [SOURCED_FIELD]: stamp(entity, ['services[].stock', 'services[].restrictions']),
      },
      gaps: [
        'item links: the engine rules select categories and generated items; they do not name stable promoted item entities for each roll',
        'wiringContract: the reference engine does not define PoF registration, activation, dependencies, or verification',
      ],
    });
  }

  const markupPct = towner === 'Wirt' ? 50 : towner === 'Cain' ? REFERENCE_GAP : 0;
  const buybackPct = towner === 'Griswold' || towner === 'Adria' ? 25 : 0;
  seeds.push(
    {
      catalogId: 'vendors', entityId: entity.id, step: 'Pricing & Restock',
      data: {
        pricing: {
          markupPct,
          buybackPct,
          restockHours: REFERENCE_GAP,
          currency: 'gold',
          rules: services.map((service) => ({
            service: service.id,
            buyPrice: service.buyPrice,
            sellPrice: service.sellPrice,
            otherCosts: service.otherCosts,
            restock: service.restock,
            hellfireDelta: service.hellfireDelta,
          })),
        },
        [SOURCED_FIELD]: stamp(entity, ['services[].buyPrice', 'services[].sellPrice', 'services[].otherCosts', 'services[].restock', '(laws d1-store-pricing-law, d1-store-stock-law, d1-store-service-fees-law)']),
      },
      gaps: commonGaps,
    },
    {
      catalogId: 'vendors', entityId: entity.id, step: 'Reputation Modifiers',
      data: {
        repMods: {
          repTier: 'none',
          discountCurve: 'none',
          discountTiers: {},
          discountNote: 'The engine applies no faction, reputation, or relationship modifier to any town price or fee.',
        },
        [SOURCED_FIELD]: stamp(entity, ['(law d1-store-overview-law)']),
      },
      gaps: ['wiringContract: no reputation dependency exists in the reference engine'],
    },
    {
      catalogId: 'vendors', entityId: entity.id, step: 'Buy/Sell/Repair',
      data: {
        services: {
          ...SERVICE_FLAGS[towner],
          recharge: services.some((service) => service.kind === 'recharge'),
          healing: services.some((service) => service.kind === 'healing'),
          inspection: services.some((service) => service.kind === 'inspection-shop'),
          identify: services.some((service) => service.kind === 'identify'),
          currency: 'gold',
          rules: services.map((service) => ({ service: service.id, restrictions: service.restrictions })),
        },
        [SOURCED_FIELD]: stamp(entity, ['services[].kind', 'services[].restrictions', '(law d1-store-overview-law)']),
      },
      gaps: ['wiringContract: the reference engine does not define PoF currency-subsystem or vendor-component wiring'],
    },
  );
  return seeds;
}

const CHARACTER_VENDOR: Readonly<Record<string, { towner: StoreTowner; interaction: 'store' | 'service' }>> = {
  'd1-TOWN_SMITH': { towner: 'Griswold', interaction: 'store' },
  'd1-TOWN_WITCH': { towner: 'Adria', interaction: 'store' },
  'd1-TOWN_HEALER': { towner: 'Pepin', interaction: 'store' },
  'd1-TOWN_PEGBOY': { towner: 'Wirt', interaction: 'store' },
  'd1-TOWN_STORY': { towner: 'Cain', interaction: 'service' },
};

/** Bind each engine towner to both its W16 conversation and its town-service entity. */
export function seedCharacterVendorSteps(entity: StoreCatalogEntity): StepSeed[] {
  if (entity.catalogId !== 'characters') return [];
  const binding = CHARACTER_VENDOR[entity.id];
  if (!binding) return [];
  const vendor = vendorEntities().find((wrapper) => wrapper.entity.id === vendorEntityId(binding.towner))!.entity;
  const npcId = STORE_SPECS.find((spec) => spec.towner === binding.towner)!.npcId;
  const dialogueBinding = `d1-dialog-${npcId}`;
  const vendorBinding = vendor.id;
  return [{
    catalogId: 'characters', entityId: entity.id, step: 'Behavior (NPC)',
    data: {
      behavior: {
        role: binding.interaction === 'store' ? 'Vendor' : 'ServiceProvider',
        npcId,
        interactions: [
          { type: 'dialogue', dialogueBinding },
          { type: binding.interaction, vendorBinding },
        ],
      },
      links: [
        { catalogId: 'dialog-trees', entityId: dialogueBinding, role: 'host' },
        { catalogId: 'vendors', entityId: vendorBinding, role: binding.interaction },
      ],
      [SOURCED_FIELD]: {
        sourceGame: vendor.provenance.sourceGame,
        sourceFile: `${entity.provenance.sourceFile}, ${vendor.provenance.sourceFile}`,
        sourceRow: `${entity.provenance.sourceRow}; ${vendor.provenance.sourceRow}`,
        columns: ['type', 'services[].kind', '(engine conversation and store bindings)'],
      },
    },
    gaps: ['wiringContract: the reference engine does not define PoF dialogue-component or vendor-component wiring'],
  }];
}
