import { describe, it, expect } from 'vitest';
import {
  asLootBinding,
  computeExpectedValue,
  rarityBreakdown,
  lintLootEconomy,
  RARITY_ORDER,
  type LootBindingLike,
} from '@/lib/loot/economy';

function bind(over: Partial<LootBindingLike> = {}): LootBindingLike {
  return {
    lootTableName: 'LT_Test',
    dropChance: 0.3,
    rarityWeights: [60, 25, 10, 4, 1],
    bonusGold: 15,
    ...over,
  };
}

describe('asLootBinding', () => {
  it('parses a well-shaped binding', () => {
    const b = asLootBinding({ lootTableName: 'LT_X', dropChance: 0.4, rarityWeights: [50, 30, 15, 4, 1], bonusGold: 20 });
    expect(b).not.toBeNull();
    expect(b!.dropChance).toBe(0.4);
  });

  it('returns null when required fields are missing', () => {
    expect(asLootBinding({ id: 'x' })).toBeNull();
    expect(asLootBinding(null)).toBeNull();
    expect(asLootBinding({ dropChance: 0.5, bonusGold: 10 })).toBeNull(); // no rarityWeights
  });
});

describe('computeExpectedValue', () => {
  it('combines drop chance, rarity-weighted item gold, and bonus gold', () => {
    // 0.3 * (0.6*5 + 0.25*15 + 0.1*50 + 0.04*200 + 0.01*1000) + 15 = 0.3*29.75 + 15 = 23.925
    expect(computeExpectedValue(bind())).toBe(24);
  });

  it('is just bonus gold when the drop chance is 0', () => {
    expect(computeExpectedValue(bind({ dropChance: 0 }))).toBe(15);
  });

  it('handles all-zero weights without dividing by zero', () => {
    expect(computeExpectedValue(bind({ rarityWeights: [0, 0, 0, 0, 0], bonusGold: 5 }))).toBe(5);
  });
});

describe('rarityBreakdown', () => {
  it('returns one row per rarity in order with EV contributions summing to the item EV', () => {
    const rows = rarityBreakdown(bind());
    expect(rows.map((r) => r.rarity)).toEqual(RARITY_ORDER);
    const itemEv = rows.reduce((s, r) => s + r.contribution, 0);
    // item EV (excl. bonus) = 0.3 * 29.75 = 8.925
    expect(itemEv).toBeCloseTo(8.925, 3);
  });
});

describe('lintLootEconomy', () => {
  it('passes a well-formed binding with enough peers', () => {
    const peers = [
      bind({ lootTableName: 'LT_A' }),
      bind({ lootTableName: 'LT_B', bonusGold: 20 }),
      bind({ lootTableName: 'LT_C', bonusGold: 10 }),
    ];
    const findings = lintLootEconomy(bind({ lootTableName: 'LT_Self' }), peers);
    expect(findings.every((f) => f.severity === 'ok')).toBe(true);
  });

  it('errors when rarityWeights is not length 5', () => {
    const findings = lintLootEconomy(bind({ rarityWeights: [50, 50] }), []);
    expect(findings.some((f) => f.severity === 'error' && /5 entries/i.test(f.message))).toBe(true);
  });

  it('warns when weights do not sum to ~100', () => {
    const findings = lintLootEconomy(bind({ rarityWeights: [10, 10, 10, 10, 10] }), []);
    expect(findings.some((f) => f.severity === 'warn' && /sum/i.test(f.message))).toBe(true);
  });

  it('errors on an out-of-range drop chance', () => {
    const findings = lintLootEconomy(bind({ dropChance: 1.5 }), []);
    expect(findings.some((f) => f.severity === 'error' && /drop chance/i.test(f.message))).toBe(true);
  });

  it('flags an EV that is a large outlier versus peers', () => {
    const peers = [
      bind({ lootTableName: 'LT_A' }),
      bind({ lootTableName: 'LT_B' }),
      bind({ lootTableName: 'LT_C' }),
    ]; // EV ~24 each
    const rich = bind({ lootTableName: 'LT_Rich', bonusGold: 5000 }); // way above peer median
    const findings = lintLootEconomy(rich, peers);
    expect(findings.some((f) => f.severity === 'warn' && /value/i.test(f.message))).toBe(true);
  });
});
