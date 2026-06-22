import { describe, it, expect } from 'vitest';
import { minLength, fieldsPopulated, withinPercent, dpsConsistent, selected, minCount } from '@/lib/catalog/acceptance/dataCheckers';

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
