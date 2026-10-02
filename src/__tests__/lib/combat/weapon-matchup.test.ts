import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  MATCHUP_TARGETS, weaponMatchup, rankForTarget, outOfBand, type MatchupTarget,
} from '@/lib/combat/weapon-matchup';
import { weaponDps, weaponRoster } from '@/lib/combat/weapon-throughput';
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';
import { WEAPONS } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// Compare weapons against an enemy (scan-sweep --challenge combat-metrics/B):
// time-to-kill on the one weapon-DPS law (weapon-throughput, canon armour) graded
// by the one fight-length law (encounter-bands), never a private cut.

const byId = (id: string) => {
  const w = WEAPONS.find(x => x.id === id);
  if (!w) throw new Error(`no weapon ${id}`);
  return w;
};
const target = (id: string): MatchupTarget => {
  const t = MATCHUP_TARGETS.find(x => x.id === id);
  if (!t) throw new Error(`no target ${id}`);
  return t;
};

describe('weapon-matchup', () => {
  it('MATCHUP_TARGETS is a no-armour dummy plus one row per ENEMY_ARCHETYPES entry, read from baseAttributes', () => {
    expect(MATCHUP_TARGETS.map(t => t.id)).toEqual(['dummy', 'melee-grunt', 'ranged-caster', 'brute', 'elite-knight']);
    expect(MATCHUP_TARGETS).toHaveLength(ENEMY_ARCHETYPES.length + 1);
    const knight = target('elite-knight');
    expect(knight).toMatchObject({ name: 'Hollow Knight', hp: 200, armour: 15 });
    for (const a of ENEMY_ARCHETYPES) {
      const t = target(a.id);
      expect(t.hp).toBe(a.baseAttributes.maxHealth);
      expect(t.armour).toBe(a.baseAttributes.armor);
    }
    expect(target('dummy')).toMatchObject({ hp: null, armour: 0 });
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'combat', 'weapon-matchup.ts'), 'utf8');
    expect(src).toMatch(/ENEMY_ARCHETYPES/);
    expect(src).not.toMatch(/Hollow Knight|\b200\b/);
  });

  it('Walking Staff vs Hollow Knight stalls at 45.8 s, graded by encounter-bands (no inline TTK cut)', () => {
    const m = weaponMatchup(byId('st-walking'), target('elite-knight'));
    expect(m.ttkSec).not.toBeNull();
    expect(m.ttkSec!).toBeCloseTo(45.8, 1);
    expect(m.band).toBe('stall');
    expect(m.severity).toBe('critical');
    expect(m.dps).toBeCloseTo(weaponDps(byId('st-walking'), { armour: 15 }), 10);

    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'combat', 'weapon-matchup.ts'), 'utf8');
    expect(src).toMatch(/fightLengthBand/);
    expect(src).toMatch(/fightLengthSeverity/);
    expect(src).not.toMatch(/ttkSec\s*[<>]=?\s*\d/);
    expect(src).not.toMatch(/\b(20|45)\b/);
  });

  it('armour reorders: Twin Fangs out-DPSes the Titan Warhammer unarmoured but kills the Hollow Knight slower', () => {
    const dummy = target('dummy');
    const knight = target('elite-knight');
    expect(weaponMatchup(byId('dg-twin'), dummy).dps).toBeCloseTo(22.69, 2);
    expect(weaponMatchup(byId('mc-warhammer'), dummy).dps).toBeCloseTo(18.82, 2);
    const twin = weaponMatchup(byId('dg-twin'), knight).ttkSec!;
    const hammer = weaponMatchup(byId('mc-warhammer'), knight).ttkSec!;
    expect(twin).toBeCloseTo(11.64, 2);
    expect(hammer).toBeCloseTo(11.39, 2);
    expect(twin).toBeGreaterThan(hammer);
  });

  it('rankForTarget(Hollow Knight): 44 rows by TTK, dg-soul first, bands 33/10/1, 24 rank moves vs the dummy', () => {
    const r = rankForTarget(WEAPONS, target('elite-knight'));
    expect(r.rows).toHaveLength(44);
    const ttks = r.rows.map(x => x.ttkSec!);
    expect([...ttks].sort((a, b) => a - b)).toEqual(ttks);
    expect(r.rows[0].id).toBe('dg-soul');
    expect(r.rows[0].ttkSec!).toBeCloseTo(5.93, 2);
    expect(r.bandCounts).toEqual({ healthy: 33, long: 10, stall: 1 });
    expect(r.rows.filter(x => x.rankDelta !== 0)).toHaveLength(24);
  });

  it('Forest Grunt is all-healthy; [guard-after-A] the dummy has no TTK and keeps the roster order', () => {
    const grunt = rankForTarget(WEAPONS, target('melee-grunt'));
    expect(grunt.bandCounts).toEqual({ healthy: 44 });
    expect(outOfBand(grunt.rows, 4)).toEqual([]);

    const dummy = rankForTarget(WEAPONS, target('dummy'));
    expect(dummy.rows.every(x => x.ttkSec === null && x.band === null)).toBe(true);
    expect(dummy.rows.map(x => x.id)).toEqual(weaponRoster(WEAPONS).rows.map(x => x.id));
    expect(dummy.bandCounts).toEqual({});
  });

  it('outOfBand(Hollow Knight, 4) lists 4 flagged weapons worst-first, Walking Staff first', () => {
    const r = rankForTarget(WEAPONS, target('elite-knight'));
    const ids = outOfBand(r.rows, 4);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe('st-walking');
    for (const id of ids) expect(r.rows.find(x => x.id === id)!.band).not.toBe('healthy');
  });
});
