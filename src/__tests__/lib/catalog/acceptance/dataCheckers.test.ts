import { describe, it, expect } from 'vitest';
import { minLength, fieldsPopulated, withinPercent, withinAbsolute, dpsConsistent, materialShape, selected, minCount, entriesHaveFields } from '@/lib/catalog/acceptance/dataCheckers';
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
  it('withinAbsolute gates on the SIGNED value (handles a negative target)', () => {
    const c = withinAbsolute('lufs', 'LUFS −16 ±2', -16, 2);
    expect(c({ lufs: -16 }).status).toBe('pass');   // on target
    expect(c({ lufs: -14 }).status).toBe('pass');   // band edge (loudest)
    expect(c({ lufs: -18 }).status).toBe('pass');   // band edge (quietest)
    expect(c({ lufs: -12 }).status).toBe('fail');   // too loud
    expect(c({ lufs: -20 }).status).toBe('fail');   // too quiet
    expect(c({}).status).toBe('pending');           // unset → actionable pending
    expect(c({}).reason).toContain('"lufs"');
    // withinPercent's ±% band would flip its ordering for a negative target and never pass:
    expect(withinPercent('lufs', 'x', -16, 12.5)({ lufs: -16 }).status).toBe('fail');
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

describe('materialShape — single-master OR multi-master, either accepted', () => {
  const c = materialShape('material', 'material shape');
  const tex = { albedo: 'a', normal: 'n', orm: 'o' };

  it('legacy single-master shape still passes', () => {
    expect(c({ material: { surface: 'iron', parentMaterial: '/Game/M_Master', textures: tex } }).status).toBe('pass');
    // strictly parentMaterial + textures — surface omitted still passes on the legacy path
    expect(c({ material: { parentMaterial: '/Game/M_Master', textures: tex } }).status).toBe('pass');
  });

  it('a two-master parentMaterials[] array passes when every entry is complete', () => {
    const r = c({ material: { parentMaterials: [
      { surface: 'blade', parentMaterial: '/Game/M_Metal', textures: tex },
      { surface: 'grip', parentMaterial: '/Game/M_Leather', textures: tex },
    ] } });
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('2 master');
  });

  it('a malformed array entry FAILS naming the offending index', () => {
    const r = c({ material: { parentMaterials: [
      { surface: 'blade', parentMaterial: '/Game/M_Metal', textures: tex },
      { surface: 'grip', parentMaterial: '/Game/M_Leather' }, // missing textures
    ] } });
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('parentMaterials[1]');
    expect(r.reason).toContain('textures');
  });

  it('legacy shape missing a required key is pending, naming it', () => {
    const r = c({ material: { surface: 'iron' } });
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('parentMaterial');
    expect(r.reason).toContain('textures');
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

describe('withinPercent grades a dot-path (the charted datum, not a duplicated mirror)', () => {
  it('resolves a nested field', () => {
    expect(withinPercent('gpuBudget.gpuMs', 'GPU', 0.48, 15)({ gpuBudget: { gpuMs: 0.48 } }).status).toBe('pass');
    expect(withinPercent('gpuBudget.gpuMs', 'GPU', 0.48, 15)({ gpuBudget: { gpuMs: 0.9 } }).status).toBe('fail');
  });
  it('an unreachable path is pending and names the path', () => {
    const r = withinPercent('gpuBudget.gpuMs', 'GPU', 0.48, 15)({ gpuBudget: {} });
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('gpuBudget.gpuMs');
  });
  it('a plain field name behaves exactly as before', () => {
    expect(withinPercent('ratio', 'R', 100, 10)({ ratio: 95 }).status).toBe('pass');
  });
});

describe('entriesHaveFields — content floor above a length-only count', () => {
  const check = entriesHaveFields('rows', 'every row carries a + b', ['a', 'b']);
  it('passes when every entry carries every key', () => {
    const r = check({ rows: [{ a: 1, b: 2 }, { a: 3, b: 4 }] });
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('2 entries');
  });
  it('fails naming the offending index and the missing keys', () => {
    const r = check({ rows: [{ a: 1, b: 2 }, { a: 3 }] });
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('[1]');
    expect(r.reason).toContain('b');
  });
  it('fails when an entry is not an object', () => {
    expect(check({ rows: ['nope'] }).status).toBe('fail');
  });
  it('is pending (never a false pass) for an absent or empty array', () => {
    expect(check({}).status).toBe('pending');
    expect(check({ rows: [] }).status).toBe('pending');
  });
});
