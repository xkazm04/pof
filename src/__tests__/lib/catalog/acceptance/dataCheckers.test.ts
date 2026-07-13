import { describe, it, expect } from 'vitest';
import { minLength, fieldsPopulated, withinPercent, dpsConsistent, selected, minCount } from '@/lib/catalog/acceptance/dataCheckers';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { safeAccept } from '@/lib/catalog/headless';
import type { Checker } from '@/lib/catalog/acceptance/types';

describe('L0 data checkers', () => {
  it('minLength passes at/above threshold, pending below', () => {
    const c = minLength('brief', 'Brief ≥ 300 chars', 300);
    expect(c({ brief: 'x'.repeat(300) }).status).toBe('pass');
    expect(c({ brief: 'short' }).status).toBe('pending');
    expect(c({ brief: 'x'.repeat(300) }).tier).toBe('L0');
  });
  it('fieldsPopulated requires every key present', () => {
    const c = fieldsPopulated('stats', 'All stats', ['Damage', 'Weight']);
    expect(c({ stats: { Damage: 1, Weight: 2 } }).status).toBe('pass');
    expect(c({ stats: { Damage: 1 } }).status).toBe('pending');
  });
  it('withinPercent fails outside the band', () => {
    const c = withinPercent('power', 'Power ±10%', 100, 10);
    expect(c({ power: 105 }).status).toBe('pass');
    expect(c({ power: 130 }).status).toBe('fail');
    expect(c({}).status).toBe('pending');
  });
  it('selected passes when an index ≥ 0 is chosen', () => {
    const c = selected('selected', 'Icon selected');
    expect(c({ selected: 0 }).status).toBe('pass');
    expect(c({ selected: -1 }).status).toBe('pending');
    expect(c({}).status).toBe('pending');
  });
  it('minCount counts array length', () => {
    const c = minCount('cues', 'Cues', 3);
    expect(c({ cues: [1, 2, 3] }).status).toBe('pass');
    expect(c({ cues: [1] }).status).toBe('pending');
  });
  it('dpsConsistent is tier-agnostic: validates DPS vs the weapon’s own damage × APS', () => {
    const c = dpsConsistent('damage', 'baseDPS', 'Base DPS consistent', 12);
    // tier-1 sword: 15 avg × 0.8333 APS ≈ 12.5
    expect(c({ damage: { damageMin: 12, damageMax: 18, attackSpeed: 0.8333 }, baseDPS: 12.5 }).status).toBe('pass');
    // Legendary energy blade: 38 avg × 1.0 APS = 38 — must ALSO pass (the old fixed-12.5 gate failed this)
    expect(c({ damage: { damageMin: 30, damageMax: 46, attackSpeed: 1.0 }, baseDPS: 38 }).status).toBe('pass');
    // inconsistent: claims 38 DPS but the stats only support ~12.5
    expect(c({ damage: { damageMin: 12, damageMax: 18, attackSpeed: 0.8333 }, baseDPS: 38 }).status).toBe('fail');
    // missing inputs → pending (actionable), not a false pass
    expect(c({ baseDPS: 38 }).status).toBe('pending');
  });
});

describe('non-pass checkers emit a SPECIFIC reason naming the offending field', () => {
  it('minLength pending names the field + shortfall', () => {
    const r = minLength('brief', 'Brief', 300)({ brief: 'nope' });
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('"brief"');
    expect(r.reason).toContain('300');
  });
  it('fieldsPopulated pending lists the missing keys', () => {
    const r = fieldsPopulated('stats', 'Stats', ['health', 'damage', 'armor'])({ stats: { health: 1 } });
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('"stats"');
    expect(r.reason).toContain('damage');
    expect(r.reason).toContain('armor');
  });
  it('withinPercent pending names the unset field', () => {
    expect(withinPercent('ratio', 'R', 100, 15)({}).reason).toContain('"ratio"');
  });
  it('selected pending names the field', () => {
    expect(selected('selected', 'Icon')({}).reason).toContain('"selected"');
  });
  it('minCount pending names the field + shortfall', () => {
    const r = minCount('assets', 'Assets', 4)({ assets: ['a'] });
    expect(r.reason).toContain('"assets"');
    expect(r.reason).toContain('4');
  });
  it('graphValid pending (no graph) names the field', () => {
    expect(graphValid('flow', 'Flow')({}).reason).toContain('"flow"');
  });
});

describe('safeAccept surfaces the real throw message (not opaque "unverified")', () => {
  it('a thrown checker degrades to pending and reports the truncated message', () => {
    const boom: Checker = () => { throw new Error('boom: economy row missing'); };
    const r = safeAccept(boom, {});
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('boom: economy row missing');
  });
});
