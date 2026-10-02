import { describe, it, expect } from 'vitest';
import {
  parseWeaponStats, weaponDps, weaponRoster, ATTRIBUTE_WEAPON_LAW,
} from '@/lib/combat/weapon-throughput';
import { CRIT_MULTIPLIER } from '@/lib/combat/canon-kernel';
import {
  WEAPONS, WEAPON_GROUPINGS, parseDamageMidpoint,
} from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// One weapon-DPS law on the canon kernel (scan-sweep --challenge combat-metrics/A):
// the Combat Metrics tab, chart, STR/DEX sliders and Feature Map tiles all read
// this model, so crit is canon x2.5 capped at 95% and armour is soft-capped.

const byId = (id: string) => {
  const w = WEAPONS.find(x => x.id === id);
  if (!w) throw new Error(`no weapon ${id}`);
  return w;
};

describe('weapon-throughput', () => {
  it('parseWeaponStats parses the display strings and names a malformed field (never NaN)', () => {
    const iron = parseWeaponStats(byId('sw-iron'));
    expect(iron).toEqual({ ok: true, data: { dmgLo: 8, dmgHi: 14, intervalSec: 1.4, critChance: 0.05 } });

    const bad = parseWeaponStats({ ...byId('sw-iron'), baseDamage: '12' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('baseDamage');

    // the legacy helper no longer yields NaN for a single-number string
    expect(Number.isNaN(parseDamageMidpoint('12'))).toBe(false);
    expect(parseDamageMidpoint('12')).toBeNull();
    expect(parseDamageMidpoint('8-14')).toBe(11);
  });

  it('weaponDps uses canon crit (x2.5), not a x2 crit', () => {
    expect(weaponDps(byId('dg-soul'))).toBeCloseTo((18 / 0.6) * (1 + 0.18 * (CRIT_MULTIPLIER - 1)), 6);
    expect(weaponDps(byId('dg-soul'))).toBeCloseTo(38.1, 2);
  });

  it('weaponDps: sw-iron 8.446, crit capped at 95%, armour soft-capped through computeHit', () => {
    expect(Math.abs(weaponDps(byId('sw-iron')) - 8.446)).toBeLessThan(0.001);
    const over = { ...byId('sw-iron'), critChance: '120%' };
    expect(weaponDps(over)).toBeCloseTo((11 / 1.4) * 2.425, 6);
    expect(Math.abs(weaponDps(byId('mc-warhammer'), { armour: 15 }) - 17.55)).toBeLessThan(0.01);
    // a malformed row is 0 DPS, never NaN
    expect(weaponDps({ ...byId('sw-iron'), attackSpeed: 'fast' })).toBe(0);
  });

  it('weaponDps applies the declared ATTRIBUTE_WEAPON_LAW', () => {
    expect(ATTRIBUTE_WEAPON_LAW.baseline).toBe(10);
    const buffed = weaponDps(byId('sw-iron'), { attributes: { str: 14, dex: 14 } });
    expect(Math.abs(buffed - 15.905)).toBeLessThan(0.001);
    expect(weaponDps(byId('sw-iron'), { attributes: { str: 10, dex: 10 } })).toBe(weaponDps(byId('sw-iron')));
  });

  it('weaponRoster ranks, groups and summarises the 44 weapons', () => {
    const r = weaponRoster(WEAPONS);
    expect(r.rows).toHaveLength(44);
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i - 1].dps).toBeGreaterThanOrEqual(r.rows[i].dps);
    expect(r.best?.id).toBe('dg-soul');
    expect(Math.abs(r.meanDps - 16.17)).toBeLessThan(0.01);
    expect(r.groups.map(g => g.category)).toEqual(WEAPON_GROUPINGS[0].order);
    for (const g of r.groups) {
      expect(g.avgDps).toBeGreaterThan(0);
      expect(g.maxDps).toBe(Math.max(...g.rows.map(x => x.dps)));
    }
    expect(r.globalMax).toBe(r.rows[0].dps);
  });
});
