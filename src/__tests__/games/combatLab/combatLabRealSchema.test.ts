import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GTAI_GAME } from '@/lib/games/gtai';
import { readSessions } from '@/lib/games/combatLab/readCombatLab';
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
const table = (doc: unknown): CombatTable => ({ key: 'weapons', file: 'w.json', ...parseTable('weapons', 'w.json', doc) });

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
  it('reads a course session course_time_s as its own metric (a course run has no shots)', () => {
    expect(metricsOf({ course_time_s: 15.5, shots: 0, hit_rate: 0, knockdowns: 0 })).toEqual([{ key: 'knockdowns', value: 0 }, { key: 'courseTime', value: 15.5 }]);
  });
  it('reads a pit session pit time, kills, waves cleared and cover stops; a session with no pit has none', () => {
    const pit = { pit_done_s: 12.4, pit_kills: 5, pit_waves: 2, pit_waves_cleared: 2, shots_stopped_by_cover: 2, knockdowns: 0 };
    expect(metricsOf(pit)).toEqual([{ key: 'knockdowns', value: 0 }, { key: 'pitTime', value: 12.4 }, { key: 'pitKills', value: 5 }, { key: 'pitWaves', value: 2 }, { key: 'coverStops', value: 2 }]);
    expect(metricsOf({ pit_kills: 0, pit_waves: 0, pit_waves_cleared: 0, knockdowns: 0 })).toEqual([{ key: 'knockdowns', value: 0 }]);
  });
  it('treats the arena -1 latency and a no-shot hit rate as not recorded', () => {
    const m = metricsOf({ shots: 0, hit_rate: 0, input_latency_mean_ticks: -1, knockdowns: 0 });
    expect(m).toEqual([{ key: 'knockdowns', value: 0 }]);
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

describe('where the arena lane leaves its telemetry', () => {
  it('the GTAI config reads evidence/arena in the arena lane worktree (the range-bot session)', () => {
    const cfg = GTAI_GAME.combatLab!;
    expect(cfg.telemetryDirs).toContain('evidence/arena');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-arena-ev-'));
    try {
      fs.mkdirSync(path.join(root, 'evidence', 'arena'), { recursive: true });
      fs.writeFileSync(path.join(root, 'evidence', 'arena', 'arena-range-telemetry.json'), JSON.stringify(TELEMETRY));
      const s = readSessions(cfg.telemetryDirs, [{ id: 'arena', label: 'lane arena', root }], Date.now());
      expect(s.map((x) => x.file)).toEqual(['arena-range-telemetry.json']);
      expect(s[0].ttk.length).toBe(2);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
