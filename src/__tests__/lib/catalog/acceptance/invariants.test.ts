import { describe, it, expect } from 'vitest';
import {
  POWER_TARGET, POWER_TOL_PCT, PRICE_RATIO, FAUCET_SINK_TOL_PCT, REQ_BELOW, AFFIX_BUDGET,
  XP_GROWTH, MONSTER_LIFE_BAND,
  powerWithinTierTarget, priceRatioWithinBand, faucetSinkBalanced, requiredLevelBand,
  rarityAffixBudget, monsterRarityWithinBands, xpGrowthWithinBand,
  componentsSumTo, sumReconciles, arithmeticReconciles,
} from '@/lib/catalog/acceptance/invariants';

describe('canon threshold parsing (from CANON_SEED, not hardcoded)', () => {
  it('reads proj-balance power target + price/power band', () => {
    expect(POWER_TARGET).toBe(100);
    expect(POWER_TOL_PCT).toBe(10);
    expect(PRICE_RATIO).toEqual({ min: 0.8, max: 1.2 });
  });
  it('reads proj-economy faucet/sink tolerance', () => { expect(FAUCET_SINK_TOL_PCT).toBe(15); });
  it('reads arpg-item-level required-level band', () => { expect(REQ_BELOW).toEqual({ min: 5, max: 15 }); });
  it('reads arpg-item-rarity affix budgets', () => {
    expect(AFFIX_BUDGET.Magic).toEqual({ prefix: 1, suffix: 1 });
    expect(AFFIX_BUDGET.Rare).toEqual({ prefix: 3, suffix: 3 });
  });
  it('reads arpg-leveling XP growth + arpg-monster-rarity life bands', () => {
    expect(XP_GROWTH).toBe(1.08);
    expect(MONSTER_LIFE_BAND.Magic).toEqual({ min: 1.5, max: 2 });
    expect(MONSTER_LIFE_BAND.Rare).toEqual({ min: 4, max: 6 });
    expect(MONSTER_LIFE_BAND.Unique).toEqual({ min: 6, max: 10 });
  });
});

describe('invariant checkers — compliant passes, violating fails with a specific reason', () => {
  it('powerWithinTierTarget', () => {
    expect(powerWithinTierTarget('power', 'p', 'target')({ power: 102, target: 100 }).status).toBe('pass');
    const bad = powerWithinTierTarget('power', 'p', 'target')({ power: 130, target: 100 });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('proj-balance power target');
    expect(bad.reason).toContain('130');
  });

  it('priceRatioWithinBand', () => {
    expect(priceRatioWithinBand('r', 'p')({ r: 1.001 }).status).toBe('pass');
    const bad = priceRatioWithinBand('r', 'p')({ r: 1.4 });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('1.4×');
    expect(bad.reason).toContain('0.8–1.2×');
  });

  it('faucetSinkBalanced', () => {
    expect(faucetSinkBalanced('b', 'f', 's', 'p')({ b: { f: 110, s: 105 } }).status).toBe('pass');
    const bad = faucetSinkBalanced('b', 'f', 's', 'p')({ b: { f: 200, s: 100 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('proj-economy faucet/sink');
    expect(bad.reason).toContain('±15%');
  });

  it('requiredLevelBand', () => {
    expect(requiredLevelBand('i', 'ilvl', 'req', 'p')({ i: { ilvl: 40, req: 30 } }).status).toBe('pass');
    const bad = requiredLevelBand('i', 'ilvl', 'req', 'p')({ i: { ilvl: 40, req: 40 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('arpg-item-level');
  });

  it('rarityAffixBudget', () => {
    expect(rarityAffixBudget('t', 'rarity', 'pfx', 'sfx', 'p')({ t: { rarity: 'Rare', pfx: 3, sfx: 2 } }).status).toBe('pass');
    const bad = rarityAffixBudget('t', 'rarity', 'pfx', 'sfx', 'p')({ t: { rarity: 'Magic', pfx: 3, sfx: 0 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('Magic allows ≤1 prefixes, got 3');
  });

  it('monsterRarityWithinBands', () => {
    const good = { r: { rarityScale: { Magic: { lifeMulti: 1.75 }, Rare: { lifeMulti: 5 }, Unique: { lifeMulti: 8 } } } };
    expect(monsterRarityWithinBands('r', 'p')(good).status).toBe('pass');
    const bad = { r: { rarityScale: { Magic: { lifeMulti: 3 }, Rare: { lifeMulti: 5 }, Unique: { lifeMulti: 8 } } } };
    const res = monsterRarityWithinBands('r', 'p')(bad);
    expect(res.status).toBe('fail');
    expect(res.reason).toContain('Magic life multiplier ×3');
  });

  it('xpGrowthWithinBand', () => {
    expect(xpGrowthWithinBand('c', 'exponent', 'p')({ c: { exponent: 1.08 } }).status).toBe('pass');
    const bad = xpGrowthWithinBand('c', 'exponent', 'p')({ c: { exponent: 2.0 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('arpg-leveling');
  });

  it('componentsSumTo', () => {
    expect(componentsSumTo('o', ['a', 'b', 'c', 'd'], 100, 'p')({ o: { a: 75, b: 20, c: 4.5, d: 0.5 } }).status).toBe('pass');
    const bad = componentsSumTo('o', ['a', 'b'], 100, 'p')({ o: { a: 60, b: 20 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('sum to 80');
  });

  it('sumReconciles', () => {
    expect(sumReconciles('t.total', 't.parts', ['NW', 'NE'], 'p')({ t: { total: 15, parts: { NW: 6, NE: 9 } } }).status).toBe('pass');
    const bad = sumReconciles('t.total', 't.parts', ['NW', 'NE'], 'p')({ t: { total: 20, parts: { NW: 6, NE: 9 } } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('does not reconcile');
  });

  it('arithmeticReconciles product + quotient', () => {
    expect(arithmeticReconciles('b', { result: 'r', op: 'product', operands: ['k', 'p'] }, 'p')({ b: { r: 12, k: 600, p: 0.02 } }).status).toBe('pass');
    const bad = arithmeticReconciles('b', { result: 'r', op: 'product', operands: ['k', 'p'] }, 'p')({ b: { r: 99, k: 600, p: 0.02 } });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('does not reconcile');
    expect(arithmeticReconciles('b', { result: 'm', op: 'quotient', operands: ['xp', 'rate'] }, 'p')({ b: { m: 45.1, xp: 4690, rate: 104 } }).status).toBe('pass');
  });
});
