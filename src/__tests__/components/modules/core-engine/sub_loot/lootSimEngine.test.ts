import { describe, it, expect } from 'vitest';
import {
  createRng, sampleRarity, runBatch, deviationFor, deriveEconomy, mcSummary,
  ECONOMY_KILLS_PER_HOUR,
} from '@/components/modules/core-engine/sub_loot/simulation/lootSimEngine';
import { mcStats, buildBins } from '@/components/modules/core-engine/sub_loot/simulation/monte-carlo-utils';
import { exactEV } from '@/components/modules/core-engine/sub_loot/_shared/bindingTuner';
import { DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

const equal = (dropChance: number) => ({ dropChance, rarityWeights: [20, 20, 20, 20, 20] });

describe('sampleRarity', () => {
  it('maps the rng extremes to the first and last weighted tier', () => {
    expect(sampleRarity([50, 25, 15, 8, 2], () => 0)).toBe(0);
    expect(sampleRarity([50, 25, 15, 8, 2], () => 0.999999)).toBe(4);
    expect(sampleRarity([50, 25, 15, 8, 0], () => 0.999999)).toBe(3);
  });
  it('returns -1 for all-zero weights without throwing', () => {
    expect(sampleRarity([0, 0, 0], () => 0.5)).toBe(-1);
    expect(sampleRarity([], () => 0.5)).toBe(-1);
  });
});

describe('runBatch', () => {
  const b = DEFAULT_ENEMY_LOOT_BINDINGS[0];
  it('is deterministic per seed and differs across seeds', () => {
    expect(runBatch(b, 1000, 7)).toEqual(runBatch(b, 1000, 7));
    expect(runBatch(b, 1000, 7)).not.toEqual(runBatch(b, 1000, 8));
    expect(createRng(1)()).toBe(createRng(1)());
  });
  it('honours dropChance 0 and 1', () => {
    expect(runBatch(equal(0), 500, 3).every((c) => c === 0)).toBe(true);
    expect(runBatch(equal(1), 500, 3).reduce((s, c) => s + c, 0)).toBe(500);
  });
});

describe('deviationFor', () => {
  it('uses the binding own dropChance * weight share as expected', () => {
    const d = deviationFor(equal(0.5), 0, 1000, [100, 0, 0, 0, 0]);
    expect(d.expected).toBeCloseTo(100);
    expect(d.label).toBe('as expected');
    expect(d.severity).toBe('ok');
  });
  it('flags a real deviation', () => {
    const d = deviationFor(equal(0.5), 0, 1000, [160, 0, 0, 0, 0]);
    expect(d.label).toBe('+60 above');
    expect(d.severity).toBe('error');
  });
});

describe('deriveEconomy', () => {
  const kph = ECONOMY_KILLS_PER_HOUR;
  const n = DEFAULT_ENEMY_LOOT_BINDINGS.length;
  it('gold/hour is the roster EV times kills/hour and follows the tuned gold table', () => {
    const base = deriveEconomy(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD, kph, 'casual');
    const sumEV = DEFAULT_ENEMY_LOOT_BINDINGS.reduce((s, b) => s + exactEV(b, DEFAULT_RARITY_GOLD), 0);
    expect(base.goldPerHour).toBeCloseTo((sumEV / n) * kph.casual);
    const tuned = deriveEconomy(DEFAULT_ENEMY_LOOT_BINDINGS, { ...DEFAULT_RARITY_GOLD, Legendary: 5000 }, kph, 'casual');
    expect(tuned.goldPerHour).toBeGreaterThan(base.goldPerHour);
  });
  it('hardcore scales items/hour by the profile kills/hour ratio; legendary days are finite', () => {
    const c = deriveEconomy(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD, kph, 'casual');
    const h = deriveEconomy(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD, kph, 'hardcore');
    expect(h.itemsPerHour / c.itemsPerHour).toBeCloseTo(kph.hardcore / kph.casual);
    for (const e of [c, h]) {
      expect(Number.isFinite(e.legendaryDays)).toBe(true);
      expect(e.legendaryDays!).toBeGreaterThan(0);
    }
  });
  it('a zero-EV roster has no legendary ETA (null, not Infinity)', () => {
    const e = deriveEconomy([{ ...DEFAULT_ENEMY_LOOT_BINDINGS[0], dropChance: 0 }], DEFAULT_RARITY_GOLD, kph, 'casual');
    expect(e.legendaryDays).toBeNull();
    expect(e.hoursPerLegendary).toBeNull();
  });
});

describe('mcSummary / buildBins', () => {
  it('matches mcStats on the same arrays', () => {
    const tally = { Common: [5, 9, 7, 3], Rare: [1, 1, 2, 8] };
    const s = mcSummary(tally);
    expect(s.Common).toEqual(mcStats(tally.Common));
    expect(s.Rare.median).toBe(mcStats(tally.Rare).median);
    expect(s.Rare.stddev).toBeCloseTo(mcStats(tally.Rare).stddev);
  });
  it('identical values land in one populated bin without NaN', () => {
    const bins = buildBins([4, 4, 4, 4], 5);
    expect(bins.filter((b) => b.n > 0)).toHaveLength(1);
    expect(bins.reduce((s, b) => s + b.n, 0)).toBe(4);
    expect(bins.every((b) => Number.isFinite(b.lo) && Number.isFinite(b.hi))).toBe(true);
  });
});
