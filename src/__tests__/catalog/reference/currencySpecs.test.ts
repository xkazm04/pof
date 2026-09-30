import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  CURRENCY_SPECS,
  currencyEntities,
  DIABLO1_CURRENCY_LAWS,
  seedCurrencySteps,
} from '@/lib/catalog/reference/currencySpecs';

describe('Diablo I engine-derived gold currency', () => {
  it('records named engine storage, pickup, faucets, sinks, and excludes stash as port-only', () => {
    const [gold] = CURRENCY_SPECS;
    expect(gold.id).toBe('d1-currency-gold');
    expect(gold.storage.pileCapConstant).toBe('GOLD_MAX_LIMIT');
    expect(gold.storage.totalFormula).toContain('Player::_pGold');
    expect(gold.pickup.mergeRule).toMatch(/top off.*inventory piles/i);
    expect(gold.pickup.splitRule).toMatch(/bounded numeric dialog/i);
    expect(gold.faucets.map((flow) => [flow.id, flow.lawId])).toEqual([
      ['monster-drop', 'd1-loot-gold-consumables'],
      ['item-sale', 'd1-store-pricing-law'],
    ]);
    expect(gold.questRewards.present).toBe(false);
    expect(gold.sinks.map((flow) => flow.id)).toEqual(['vendor-purchase', 'repair', 'recharge', 'identify']);
    expect(gold.portOnly[0].feature).toMatch(/stash/i);
    expect(gold.portOnly[0].rule).toMatch(/excluded/i);

    const refs = [
      ...gold.storage.refs,
      ...gold.pickup.refs,
      ...gold.faucets.flatMap((flow) => flow.refs),
      ...gold.sinks.flatMap((flow) => flow.refs),
    ];
    expect(refs.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
    expect(refs.every((ref) => /#L\d+/.test(ref))).toBe(true);
  });

  it('adds only the missing concise pile law to the Diablo canon', () => {
    expect(DIABLO1_CURRENCY_LAWS).toHaveLength(1);
    const [law] = DIABLO1_CURRENCY_LAWS;
    expect(law.id).toBe('d1-gold-pile-law');
    expect(law.body.length).toBeLessThanOrEqual(450);
    expect(law.body).toContain('GOLD_MAX_LIMIT');
    expect(law.refs?.every((ref) => ref.includes('#L'))).toBe(true);
    expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    expect(DIABLO1_CANON.filter((candidate) => candidate.id === 'd1-gold-sale-value-law')).toHaveLength(0);
    expect(DIABLO1_CANON.some((candidate) => candidate.id === 'd1-store-pricing-law')).toBe(true);
  });

  it('projects one engine-derived currency with explicit pipeline gaps and open questions', () => {
    const [wrapper] = currencyEntities();
    expect(wrapper.catalogId).toBe('currencies');
    expect(wrapper.entity.id).toBe('d1-currency-gold');
    expect(wrapper.entity.provenance.kind).toBe('ingest');
    expect(wrapper.entity.provenance.sourceFile).toContain('engine: Source/items.h');

    const gaps = wrapper.entity.data.stepGaps as Record<string, string>;
    expect(Object.keys(gaps)).toEqual(['Balance', 'Icon 2D Art', 'Test Gate', 'UE Packaging']);
    expect(gaps.Balance).toMatch(/no faucet-per-hour/i);
    const questions = wrapper.entity.data.openQuestions as string[];
    expect(questions).toHaveLength(3);
    expect(questions.join(' ')).toMatch(/wallet/i);
    expect(questions.join(' ')).toMatch(/single-currency/i);
  });

  it('seeds only checker-shaped engine-supported steps and holds each as SOURCED', () => {
    const entity = currencyEntities()[0].entity;
    const seeds = seedCurrencySteps(entity);
    expect(seeds.map((seed) => seed.step)).toEqual(['Concept Brief', 'Economy Rules', 'Wallet UI Integration']);
    expect(seeds.every((seed) => seed.data.sourced != null)).toBe(true);
    expect((seeds[0].data.brief as string).length).toBeGreaterThanOrEqual(300);

    const pipeline = getCatalogPipeline('currencies')!;
    for (const seed of seeds) {
      const result = pipeline.steps.find((step) => step.label === seed.step)!.accept(seed.data);
      expect(result.status, seed.step).toBe('pending');
      expect(result.reason, seed.step).toMatch(/^SOURCED:/);
    }

    const rules = seeds[1].data.rules as Record<string, unknown>;
    expect(rules.conversionNote).toMatch(/only gold/i);
    expect(seeds[1].gaps.join(' ')).toMatch(/multiple currencies/i);
    expect(seeds[2].gaps.join(' ')).toMatch(/no separate wallet/i);
  });

  it('builds artifacts from synthetic entity data instead of rereading the production singleton', () => {
    const original = currencyEntities()[0].entity;
    const synthetic = {
      ...original,
      data: {
        ...original.data,
        spec: {
          ...CURRENCY_SPECS[0],
          storage: { ...CURRENCY_SPECS[0].storage, carryCapFormula: 'synthetic capacity formula' },
        },
      },
      provenance: {
        ...original.provenance,
        sourceGame: 'Synthetic',
        sourceFile: 'synthetic/items.cpp',
        sourceRow: 'synthetic gold',
      },
    } as IngestedEntity;

    const seeds = seedCurrencySteps(synthetic);
    const rules = seeds.find((seed) => seed.step === 'Economy Rules')!.data.rules as {
      storage: { carryCapFormula: string };
    };
    expect(rules.storage.carryCapFormula).toBe('synthetic capacity formula');
    expect((seeds[0].data.sourced as { sourceGame: string }).sourceGame).toBe('Synthetic');
  });
});
