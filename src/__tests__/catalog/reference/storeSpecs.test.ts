import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  DIABLO1_STORE_LAWS,
  seedCharacterVendorSteps,
  seedVendorSteps,
  STORE_SPECS,
  vendorEntities,
} from '@/lib/catalog/reference/storeSpecs';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic',
  sourceProject: 'tests',
  sourceFile: 'synthetic/towners.tsv',
  sourceRow: 'type=synthetic',
  licenceNote: 'invented test values',
  ingestedAt: 't0',
  canonProfile: 'diablo1',
};

const character = (id: string): IngestedEntity => ({
  id,
  catalogId: 'characters',
  name: id,
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data: {},
  provenance,
});

describe('Diablo I engine-derived store specifications', () => {
  it('keeps all nine services with an explicit Hellfire delta field and pinned Source refs', () => {
    expect(STORE_SPECS).toHaveLength(9);
    expect(STORE_SPECS.map((spec) => spec.id)).toEqual([
      'griswold-basic',
      'griswold-premium',
      'griswold-repair',
      'adria-shop',
      'adria-recharge',
      'pepin-shop',
      'pepin-healing',
      'wirt-inspection',
      'cain-identify',
    ]);
    for (const spec of STORE_SPECS) {
      expect(Object.prototype.hasOwnProperty.call(spec, 'hellfireDelta')).toBe(true);
      expect(spec.refs.length).toBeGreaterThan(0);
      expect(spec.refs.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
    }
  });

  it('generates four concise plain-English canon laws', () => {
    expect(DIABLO1_STORE_LAWS).toHaveLength(4);
    for (const law of DIABLO1_STORE_LAWS) {
      expect(law.body.length, law.id).toBeLessThanOrEqual(450);
      expect(law.body).not.toMatch(/\bV\b|floor\s*\(/);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    }
  });

  it('projects four merchants and Cain as a justified service-only vendor', () => {
    const entities = vendorEntities();
    expect(entities.map((wrapper) => wrapper.entity.id)).toEqual([
      'd1-vendor-griswold',
      'd1-vendor-adria',
      'd1-vendor-pepin',
      'd1-vendor-wirt',
      'd1-vendor-cain',
    ]);
    const griswold = entities[0].entity;
    expect((griswold.data.services as unknown[])).toHaveLength(3);
    expect(griswold.links).toEqual([{ catalogId: 'characters', entityId: 'd1-TOWN_SMITH', role: 'host' }]);
    expect(griswold.provenance.sourceFile).toContain('engine: Source/stores.cpp');

    const cain = entities[4].entity;
    expect(cain.tags).toContain('service-only');
    expect(cain.data.classification).toMatch(/no merchandise stock/i);
    expect((cain.data.services as { id: string }[]).map((service) => service.id)).toEqual(['cain-identify']);
  });
});

describe('Diablo I vendor and character step seeds', () => {
  const entities = vendorEntities().map((wrapper) => wrapper.entity);
  const byId = (id: string) => entities.find((entity) => entity.id === id)!;

  it('seeds the engine-held vendor steps and leaves incompatible hourly and margin shapes as named gaps', () => {
    const seeds = seedVendorSteps(byId('d1-vendor-griswold'));
    expect(seeds.map((seed) => seed.step)).toEqual([
      'Inventory Pool',
      'Pricing & Restock',
      'Reputation Modifiers',
      'Buy/Sell/Repair',
    ]);
    expect(seeds.some((seed) => seed.step === 'Economy Sim')).toBe(false);
    expect(seeds.flatMap((seed) => seed.gaps).join(' ')).toMatch(/restockHours.*town setup/i);
    expect(seeds.flatMap((seed) => seed.gaps).join(' ')).toMatch(/Economy Sim.*no cost basis/i);

    const pricing = seeds.find((seed) => seed.step === 'Pricing & Restock')!.data.pricing as Record<string, unknown>;
    expect(pricing).toMatchObject({ markupPct: 0, buybackPct: 25, restockHours: REFERENCE_GAP });
    const repMods = seeds.find((seed) => seed.step === 'Reputation Modifiers')!.data.repMods;
    expect(repMods).toMatchObject({ repTier: 'none', discountCurve: 'none', discountTiers: {} });
    const services = seeds.find((seed) => seed.step === 'Buy/Sell/Repair')!.data.services;
    expect(services).toMatchObject({ buy: true, sell: true, repair: true, recharge: false });
    expect(seeds.every((seed) => seed.data.sourced != null)).toBe(true);
  });

  it('does not invent inventory for Cain and marks identification as his only extended service', () => {
    const seeds = seedVendorSteps(byId('d1-vendor-cain'));
    expect(seeds.some((seed) => seed.step === 'Inventory Pool')).toBe(false);
    expect(seeds.find((seed) => seed.step === 'Pricing & Restock')?.data.pricing)
      .toMatchObject({ markupPct: REFERENCE_GAP, buybackPct: 0, restockHours: REFERENCE_GAP });
    expect(seeds.find((seed) => seed.step === 'Buy/Sell/Repair')?.data.services)
      .toMatchObject({ buy: false, sell: false, repair: false, identify: true });
  });

  it('uses the real vendor checker shapes without allowing a SOURCED seed to pass', () => {
    const pipeline = getCatalogPipeline('vendors')!;
    for (const seed of seedVendorSteps(byId('d1-vendor-adria'))) {
      const result = pipeline.steps.find((step) => step.label === seed.step)!.accept(seed.data);
      expect(result.status, seed.step).not.toBe('pass');
      expect(result.status, seed.step).not.toBe('fail');
    }
  });

  it('binds synthetic town characters to their conversations and store or service entities', () => {
    const expected = [
      ['d1-TOWN_SMITH', 'TOWN_SMITH', 'store', 'd1-vendor-griswold'],
      ['d1-TOWN_WITCH', 'TOWN_WITCH', 'store', 'd1-vendor-adria'],
      ['d1-TOWN_HEALER', 'TOWN_HEALER', 'store', 'd1-vendor-pepin'],
      ['d1-TOWN_PEGBOY', 'TOWN_PEGBOY', 'store', 'd1-vendor-wirt'],
      ['d1-TOWN_STORY', 'TOWN_STORY', 'service', 'd1-vendor-cain'],
    ] as const;
    const pipeline = getCatalogPipeline('characters')!;
    const behaviorStep = pipeline.steps.find((step) => step.label === 'Behavior (NPC)')!;

    for (const [id, npcId, interactionType, vendorBinding] of expected) {
      const [seed] = seedCharacterVendorSteps(character(id));
      const behavior = seed.data.behavior as { npcId: string; interactions: Record<string, unknown>[] };
      expect(behavior.npcId).toBe(npcId);
      expect(behavior.interactions).toEqual([
        { type: 'dialogue', dialogueBinding: `d1-dialog-${npcId}` },
        { type: interactionType, vendorBinding },
      ]);
      expect(behaviorStep.accept(seed.data).status).toBe('pending');
    }
    expect(seedCharacterVendorSteps(character('d1-TOWN_TAVERN'))).toEqual([]);
  });
});
