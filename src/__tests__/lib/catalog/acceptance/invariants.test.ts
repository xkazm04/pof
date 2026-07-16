import { describe, it, expect } from 'vitest';
import {
  POWER_TARGET, POWER_TOL_PCT, PRICE_RATIO, FAUCET_SINK_TOL_PCT, REQ_BELOW, AFFIX_BUDGET,
  XP_GROWTH, MONSTER_LIFE_BAND, CONTROL_CC_CAP_SEC,
  powerWithinTierTarget, priceRatioWithinBand, faucetSinkBalanced, requiredLevelBand,
  rarityAffixBudget, monsterRarityWithinBands, xpGrowthWithinBand, statusBalanceEnvelope,
  componentsSumTo, sumReconciles, arithmeticReconciles,
} from '@/lib/catalog/acceptance/invariants';

const controlBudget = (over: Record<string, unknown> = {}) => ({
  balance: { controlBudget: { magnitude: 8, durationSec: 0.9, immunityWindowSec: 2, immunityTag: 'State.Immune.Knockback', clearsOnLanding: true, ...over } },
});

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
  it('reads arpg-ailments control-CC duration cap', () => { expect(CONTROL_CC_CAP_SEC).toBe(3); });
});

describe('statusBalanceEnvelope — DoT path unchanged, control path validates a budget', () => {
  const chk = statusBalanceEnvelope(7.875, 20, 'balance');

  // ── DoT path: byte-for-byte the old withinPercent('dps', 7.875, 20) law ──
  it('passes an ignite DoT whose dps is within ±20% of 7.875', () => {
    expect(chk({ dps: 7.875 }).status).toBe('pass');
    expect(chk({ dps: 9.4 }).status).toBe('pass');
  });
  it('fails a DoT whose dps is outside the band, with a specific reason', () => {
    const bad = chk({ dps: 19.5 });
    expect(bad.status).toBe('fail');
    expect(bad.reason).toContain('7.875');
    expect(bad.reason).toContain('19.5');
  });
  it('pends a DoT with no dps and points at controlBudget for CC statuses', () => {
    const r = chk({});
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('controlBudget');
  });

  // ── Control path: a knockback validates its budget, never the DPS line ──
  it('passes a well-formed kinetic control budget', () => {
    const r = chk(controlBudget());
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('control CC');
  });
  it('fails a CC whose duration exceeds the canon control cap', () => {
    const r = chk(controlBudget({ durationSec: 4 }));
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('control cap');
    expect(r.reason).toContain('3s');
  });
  it('fails a CC with a non-positive displacement magnitude', () => {
    expect(chk(controlBudget({ magnitude: 0 })).status).toBe('fail');
  });
  it('fails a CC with no immunity window (anti-chain-lock)', () => {
    const r = chk(controlBudget({ immunityWindowSec: 0 }));
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('anti-chain-lock');
  });
  it('fails a CC that does not clear on landing', () => {
    expect(chk(controlBudget({ clearsOnLanding: false })).status).toBe('fail');
  });
  it('pends an incomplete control budget', () => {
    const r = chk({ balance: { controlBudget: { magnitude: 8 } } });
    expect(r.status).toBe('pending');
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
