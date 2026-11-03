import { describe, expect, it } from 'vitest';
import { parseTable } from '@/lib/games/combatLab/parseTable';
import { metricsOf, ttkOf } from '@/lib/games/combatLab/parseSession';
import { predictTtk, targetsOf } from '@/lib/games/combatLab/predictTtk';
import type { CombatTable } from '@/lib/games/combatLab/combatTypes';

/** The shapes the evening lanes actually wrote (gtai.arena-telemetry/1, gtai.weapons/1), trimmed. */
const TELEMETRY = {
  schema: 'gtai.arena-telemetry/1', ticks: 900, shots: 20, hits: 14, hit_rate: 0.7,
  ttk_s: { static_05m: [0.5, 0.7], strafe_10m: [1.5], approach_35m: [] },
  damage_taken: 12, input_latency_ticks: [2, 3], input_latency_mean_ticks: 2.5, turn_rate_peak_dps: 540, top_speed_mps: 5.1, knockdowns: 1,
};
const WEAPONS = {
  schema: 'gtai.weapons/1',
  targets: [{ id: 'human', hp: 100 }, { id: 'robot', hp: 600 }, { id: 'broken' }],
  weapons: [
    { id: 'pistol', damage: 100, rof_hz: 4, range_m: 40, speed_mps: 60, magazine: 12, reload_s: 1.1, enabled: true, doc: 'prose' },
    { id: 'smg', damage: 50, rof_hz: 10, range_m: 28, speed_mps: 50, magazine: 3, reload_s: 2, enabled: true },
    { id: 'shotgun', damage: 20, pellets: 6, rof_hz: 1, range_m: 8, enabled: true },
    { id: 'cannon', damage: 400, rof_hz: 1, range_m: 45, enabled: false },
    { id: 'odd', enabled: true },
  ],
};
const table = (doc: unknown): CombatTable => ({ key: 'weapons', file: 'w.json', state: 'ok', ...parseTable('weapons', 'w.json', doc) });

describe('arena telemetry as the arena lane writes it', () => {
  it('reads ttk_s per spawn id: mean seconds per series and range, empty lists skipped', () => {
    expect(ttkOf(TELEMETRY)).toEqual([
      { weapon: 'static', rangeM: 5, seconds: 0.6, kills: 2 }, { weapon: 'strafe', rangeM: 10, seconds: 1.5, kills: 1 },
    ]);
  });
  it('names the weapon when the session says which it fired', () => {
    expect(ttkOf({ weapon: 'pistol', ttk_s: { static_05m: [1] } })[0].weapon).toBe('pistol · static');
  });
  it('reads latency from the mean (not the per-press list), turn rate, speed; dodges are absent, not 0', () => {
    const m = metricsOf(TELEMETRY);
    expect(m).toContainEqual({ key: 'latency', value: 2.5 });
    expect(m).toContainEqual({ key: 'topSpeed', value: 5.1 });
    expect(m.find((x) => x.key === 'dodges')).toBeUndefined();
  });
});

describe('weapon table columns and the design-side TTK', () => {
  it('leads with the columns a designer reads and puts doc prose last', () => {
    const t = parseTable('weapons', 'w.json', WEAPONS);
    expect(t.columns.slice(0, 3)).toEqual(['id', 'enabled', 'damage']);
    expect(t.columns[t.columns.length - 1]).toBe('doc');
  });
  it('takes kill targets with an id and a positive hp only', () => {
    expect(targetsOf(WEAPONS)).toEqual([{ id: 'human', hp: 100 }, { id: 'robot', hp: 600 }]);
    expect(targetsOf({})).toEqual([]);
  });
  it('shots = ceil(hp / (damage x pellets)); time = gaps at rof + reloads + flight; sorted fastest first', () => {
    const m = predictTtk(table(WEAPONS), { id: 'human', hp: 100 }, 6);
    expect(m.ready.map((p) => [p.weapon, p.shots])).toEqual([['shotgun', 1], ['pistol', 1], ['smg', 2]]);
    expect(m.ready.find((p) => p.weapon === 'pistol')!.seconds).toBeCloseTo(6 / 60, 5);
    expect(m.disabled).toEqual(['cannon']);
    expect(m.unmodelled).toEqual(['odd']);
  });
  it('adds a reload when the kill outlasts the magazine, and drops weapons out of range', () => {
    const m = predictTtk(table(WEAPONS), { id: 'robot', hp: 600 }, 20);
    const smg = m.ready.find((p) => p.weapon === 'smg')!;
    expect(smg.shots).toBe(12);
    expect(smg.seconds).toBeCloseTo(11 / 10 + 3 * 2 + 20 / 50, 5); // floor(11/3) = 3 reloads
    expect(m.outOfRange).toEqual(['shotgun']);
  });
});
