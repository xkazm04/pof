import { describe, it, expect } from 'vitest';
import { checkPriceLaw, parseLaw, priceLawDirection, type PriceLawCheck } from '@/components/layout-lab/steps/ux/economyPriceLaw';

/**
 * Fixtures are trimmed from the stored items Economy cells (~/.pof/pof.db, read 2026-10-13):
 * item-1 (Magic, ilvl 14), item-lightsaber (Unique anchor, ilvl 70) and item-7 (consumable).
 * Only the fields the law reads are kept; every number is the stored one.
 */
const LAW = {
  gearNormalRung: 'vendorBaseValue = 8g x itemLevel (the Normal rung for equippable gear)',
  rarityMultiplier: { Normal: 1, Magic: 1.35, Rare: 2.2, Unique: 'fixed named-pool anchor — stated per item' },
  buyback: 'sell = 30% of cost — ONE buyback rate for the whole catalog (canon vendor-laws)',
};

const ITEM_1 = {
  pricePowerRatio: 1,
  economy: {
    baseValue: 151, powerScore: 100, pricePowerRatio: 1,
    powerBreakdown: { dpsPower: 74, implicitAccuracyPower: 10, affixPower: 16 },
    itemsPriceLaw: LAW,
    costModel: { itemLevel: 14, rarity: 'Magic', vendorBaseValue: 112 },
    priceCheck: { goldPerPower: 1.512 },
    vendor: { buy: 151, sell: 45 },
  },
};

const LIGHTSABER = {
  pricePowerRatio: 0.95,
  economy: {
    baseValue: 1200, powerScore: 102, pricePowerRatio: 0.95, sellValue: 360, itemLevel: 70, rarity: 'Unique',
    powerBreakdown: { dpsPower: 14, implicitAccuracyPower: 25, affixPower: 63 },
    itemsPriceLaw: LAW,
    costModel: { itemLevel: 70, rarity: 'Unique', vendorBaseValue: 560, anchor: 1200 },
    priceCheck: { goldPerPower: 12.32 },
  },
};

const ITEM_7 = {
  pricePowerRatio: 1,
  economy: {
    baseValue: 10, powerScore: 10, pricePowerRatio: 1,
    // The stored breakdown carries extra numeric fields; only the three power slots are summed.
    powerBreakdown: { dpsPower: 10, implicitAccuracyPower: 0, affixPower: 0, healLife: 50, goldPerLife: 0.2 },
    itemsPriceLaw: LAW,
    costModel: { valueFormula: 'value = healLife x goldPerLife = 50 x 0.20 = 10g' },
    priceCheck: { effectFairValue: 10, actualValue: 10 },
    vendor: { buy: 10, sell: 3 },
  },
};

const term = (r: PriceLawCheck, name: string) => r.terms.find((x) => x.term === name)!;
const input = (r: PriceLawCheck, key: string) => r.inputs.find((x) => x.key === key)!.value;

describe('parseLaw — the law constants as the cell states them', () => {
  it('reads the rung, the numeric rarity multipliers and the sell ratio', () => {
    expect(parseLaw(LAW)).toEqual({ rung: 8, multipliers: { Normal: 1, Magic: 1.35, Rare: 2.2 }, buybackPct: 30 });
  });

  it('defaults nothing: a missing or reworded block yields nulls', () => {
    expect(parseLaw(undefined)).toEqual({ rung: null, multipliers: {}, buybackPct: null });
    expect(parseLaw({ gearNormalRung: 'per level', buyback: 'a third' }).rung).toBeNull();
  });
});

describe('checkPriceLaw — stored figures against the law', () => {
  it('a rung-priced item: names its inputs and agrees on every figure (item-1)', () => {
    const r = checkPriceLaw(ITEM_1);
    expect(r.kind).toBe('rung');
    expect([input(r, 'itemLevel'), input(r, 'rarity'), input(r, 'rung'), input(r, 'mult'), input(r, 'buyback')]).toEqual([14, 'Magic', 8, 1.35, '30%']);
    expect(term(r, 'vendorBaseValue')).toMatchObject({ law: 112, stored: 112, verdict: 'agrees' });
    expect(term(r, 'cost')).toMatchObject({ law: 151, stored: 151, verdict: 'agrees' });
    expect(term(r, 'goldPerPower').verdict).toBe('agrees');
    expect(term(r, 'expectedPrice').verdict).toBe('derived');
    expect(term(r, 'sell')).toMatchObject({ stored: 45, verdict: 'agrees' });
    expect(r.contradictions).toEqual([]);
    expect(r.biteBand).toEqual({ lo: 83.33, hi: 125 });
  });

  it('a Unique anchor is shown against its Rare rung, never called a contradiction (lightsaber)', () => {
    const r = checkPriceLaw(LIGHTSABER);
    expect(r.kind).toBe('anchor');
    expect(term(r, 'cost (Unique anchor)')).toMatchObject({ law: 1232, stored: 1200, verdict: 'anchor' });
    expect(term(r, 'cost (Unique anchor)').formula).toContain('0.974× the rung');
    expect(term(r, 'goldPerPower')).toMatchObject({ stored: 12.32, verdict: 'agrees' });
    expect(term(r, 'pricePowerRatio')).toMatchObject({ stored: 0.95, verdict: 'agrees' });
    expect(term(r, 'sell')).toMatchObject({ law: 360, stored: 360, at: 'economy.sellValue', verdict: 'agrees' });
    expect(r.biteBand).toBeNull();
    expect(r.contradictions).toEqual([]);
  });

  it('a consumable sits off the rung: no rung terms, ratio against effect-fair value (item-7)', () => {
    const r = checkPriceLaw(ITEM_7);
    expect(r.kind).toBe('off-rung');
    expect(r.terms.map((x) => x.term)).toEqual(['powerScore', 'pricePowerRatio', 'pricePowerRatio (graded copy)', 'sell']);
    expect(term(r, 'powerScore')).toMatchObject({ law: 10, verdict: 'agrees' });
    expect(r.contradictions).toEqual([]);
  });

  it('names each stored figure that contradicts the law, and the graded copy drifting from economy', () => {
    const drifted = {
      pricePowerRatio: 1.1,
      economy: { ...ITEM_1.economy, baseValue: 160, vendor: { buy: 160, sell: 45 }, costModel: { ...ITEM_1.economy.costModel, vendorBaseValue: 120 } },
    };
    const r = checkPriceLaw(drifted);
    expect(r.contradictions.map((x) => x.term)).toEqual(['vendorBaseValue', 'cost', 'pricePowerRatio', 'pricePowerRatio (graded copy)', 'sell']);
    expect(term(r, 'cost')).toMatchObject({ law: 151, stored: 160 });
    const dir = priceLawDirection('Iron Longsword', r);
    expect(dir).toMatch(/^Reconcile the Economy cell for "Iron Longsword" with ITEMS-PRICE-LAW/);
    expect(dir).toContain('cost stores 160 at economy.baseValue; the law gives 151 (round(112 × Magic 1.35)).');
  });

  it('a cell without the law block derives nothing and claims no agreement', () => {
    const { itemsPriceLaw: _omit, ...rest } = ITEM_1.economy;
    void _omit;
    const r = checkPriceLaw({ ...ITEM_1, economy: rest });
    expect(r.lawStated).toBe(false);
    expect(term(r, 'cost').verdict).toBe('underivable');
    expect(term(r, 'vendorBaseValue').verdict).toBe('underivable');
    expect(priceLawDirection('x', r)).toBe('');
  });
});
