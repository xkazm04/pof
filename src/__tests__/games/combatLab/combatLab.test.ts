import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseTable, recordsOf } from '@/lib/games/combatLab/parseTable';
import { metricsOf, scalarsOf, ttkOf } from '@/lib/games/combatLab/parseSession';
import { readCombatLab, readSessions, readTable, type SourceDir } from '@/lib/games/combatLab/readCombatLab';
import { resolveSources } from '@/lib/games/combatLab/combatSources';
import type { LanesBoard } from '@/lib/games/runners/runnerTypes';
import type { GameCombatLab } from '@/lib/games/types';

const CFG: GameCombatLab = {
  tables: { weapons: 'project/data/tables/weapons.json', enemies: 'project/data/tables/enemies.json', powers: 'project/data/tables/powers.json' },
  telemetryDirs: ['project/data/telemetry', 'build/telemetry'], laneRoots: ['gtai-eve'],
};
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
function tmp(): string { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-combat-')); dirs.push(d); return d; }
function put(root: string, rel: string, body: unknown, mtime?: number) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof body === 'string' ? body : JSON.stringify(body));
  if (mtime) fs.utimesSync(f, mtime / 1000, mtime / 1000);
}

describe('parseTable', () => {
  it('reads a map of id to record, flattening one level, with id/name columns first', () => {
    const t = parseTable('weapons', 'w.json', { pistol: { damage: 12, falloff: { start_m: 8, end_m: 20 }, tags: ['sidearm', 'light'] }, shotgun: { damage: 40, falloff: { start_m: 3, end_m: 9 } } });
    expect(t.state).toBe('ok');
    expect(t.rows.map((r) => r.label)).toEqual(['pistol', 'shotgun']);
    expect(t.rows[0].values).toMatchObject({ damage: 12, 'falloff.start_m': 8, tags: 'sidearm, light' });
    expect(t.columns).toContain('falloff.end_m');
  });
  it('reads an array under the table name, an array at the top, and puts id first', () => {
    expect(recordsOf({ meta: 1, other: [{ a: 1 }], enemies: [{ id: 'thug' }] }, 'enemies')).toEqual([{ rec: { id: 'thug' } }]);
    const t = parseTable('enemies', 'e.json', [{ hp: 1, id: 'thug' }]);
    expect(t.columns).toEqual(['id', 'hp']);
  });
  it('says why a document has no rows, and caps wide tables', () => {
    expect(parseTable('powers', 'p.json', 42)).toMatchObject({ state: 'invalid', reason: 'not a JSON object or array' });
    expect(parseTable('powers', 'p.json', { a: 1 })).toMatchObject({ state: 'invalid' });
    const wide = parseTable('powers', 'p.json', [Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c${i}`, i]))]);
    expect(wide.columns).toHaveLength(14);
    expect(wide.hiddenColumns).toBe(6);
  });
});

describe('parseSession', () => {
  it('finds ttk as {weapon:{range:s}}, as {weapon:{range:{mean}}} and as a record list; ranges from "10m" keys', () => {
    expect(ttkOf({ ttk: { pistol: { '5': 1.2, '10m': 1.9 } } })).toEqual([{ weapon: 'pistol', rangeM: 5, seconds: 1.2 }, { weapon: 'pistol', rangeM: 10, seconds: 1.9 }]);
    expect(ttkOf({ result: { time_to_kill: { smg: { r20: { mean: 3.1 } } } } })).toEqual([{ weapon: 'smg', rangeM: 20, seconds: 3.1 }]);
    expect(ttkOf({ ttk: [{ weapon: 'shotgun', range_m: 3, ttk_s: 0.5 }, { weapon: 'bad' }] })).toEqual([{ weapon: 'shotgun', rangeM: 3, seconds: 0.5 }]);
    expect(ttkOf({ nothing: 1 })).toEqual([]);
  });
  it('finds metrics by key at any depth and omits what is not recorded (never 0)', () => {
    const m = metricsOf({ summary: { hit_rate: 0.62, damage_taken: 0 }, latency_frames: 4, extra: { dodges: 7 } });
    expect(m).toEqual([
      { key: 'hitRate', value: 0.62 }, { key: 'damageTaken', value: 0 }, { key: 'latency', value: 4 }, { key: 'dodges', value: 7 },
    ]);
    expect(metricsOf({ knockdowns: 'many' })).toEqual([]);
  });
  it('lists top-level scalars as the fallback', () => {
    expect(scalarsOf({ a: 1, b: 'x', c: { d: 1 }, e: true })).toEqual({ a: 1, b: 'x', e: true });
  });
});

describe('readCombatLab', () => {
  function sources(): { main: SourceDir; lane: SourceDir } {
    const main = tmp(); const lane = tmp();
    put(main, CFG.tables.enemies, { enemies: [{ id: 'thug', hp: 1 }] });
    put(lane, CFG.tables.weapons, { pistol: { damage: 12 } });
    put(lane, CFG.tables.powers, '{ broken');
    put(lane, 'project/data/telemetry/s1.json', { session: 's1', ttk: { pistol: { '5': 1.2 } }, hit_rate: 0.5 }, 2_000_000_000_000);
    put(main, 'build/telemetry/s0.json', { hit_rate: 0.4, other: 1 }, 1_000_000_000_000);
    put(main, 'build/telemetry/notes.json', '{ nope', 1_500_000_000_000);
    return { main: { id: 'main', label: 'game root (main)', root: main }, lane: { id: 'gunplay', label: 'lane gunplay', root: lane } };
  }

  it('takes each table from the first source that has it, says where it came from, and is honest about missing and invalid', () => {
    const { main, lane } = sources();
    const r = readCombatLab('gtai', CFG, [main, lane], [], 'auto', new Date(2_100_000_000_000));
    const by = Object.fromEntries(r.tables.map((t) => [t.key, t]));
    expect(by.enemies).toMatchObject({ state: 'ok', from: { id: 'main' } });
    expect(by.weapons).toMatchObject({ state: 'ok', from: { id: 'gunplay' } });
    expect(by.powers).toMatchObject({ state: 'invalid', from: { id: 'gunplay' }, reason: expect.stringContaining('unparseable JSON') });
    const none = readTable('powers', CFG.tables.powers, [main]);
    expect(none).toMatchObject({ state: 'missing', rows: [] });
    expect(none.reason).toContain('project/data/tables/powers.json');
  });

  it('lists telemetry newest first across sources, skips unparseable files, and computes ages on the server', () => {
    const { main, lane } = sources();
    const s = readSessions(CFG.telemetryDirs, [main, lane], 2_000_000_100_000);
    expect(s.map((x) => x.file)).toEqual(['s1.json', 's0.json']);
    expect(s[0]).toMatchObject({ from: { id: 'gunplay' }, ageMs: 100_000, ttk: [{ weapon: 'pistol', rangeM: 5, seconds: 1.2 }] });
    expect(s[1].metrics).toEqual([{ key: 'hitRate', value: 0.4 }]);
    expect(s[1].ttk).toEqual([]);
  });

  it('reads the melee table only when the game configures one, and says where it expects it when it is absent', () => {
    const { main, lane } = sources();
    expect(readCombatLab('gtai', CFG, [main, lane], [], 'auto').tables.map((t) => t.key)).toEqual(['weapons', 'enemies', 'powers']);
    const withMelee = { ...CFG, tables: { ...CFG.tables, melee: 'project/data/tables/rivet_melee.json' } };
    const r = readCombatLab('gtai', withMelee, [main, lane], [], 'auto');
    expect(r.tables.map((t) => t.key)).toEqual(['weapons', 'melee', 'enemies', 'powers']);
    expect(r.tables[1]).toMatchObject({ state: 'missing', rows: [], reason: expect.stringContaining('rivet_melee.json') });
    put(lane.root, 'project/data/tables/rivet_melee.json', { melee_weapons: [{ id: 'baton', damage: 9 }] });
    expect(readCombatLab('gtai', withMelee, [main, lane], [], 'auto').tables[1]).toMatchObject({ state: 'ok', from: { id: 'gunplay' }, rows: [{ values: { id: 'baton', damage: 9 } }] });
  });

  it('a lab with no telemetry says where it expects it', () => {
    const r = readCombatLab('gtai', CFG, [{ id: 'main', label: 'm', root: tmp() }], [], 'main');
    expect(r.telemetry.sessions).toEqual([]);
    expect(r.telemetry.expected).toContain('project/data/telemetry');
  });
});

describe('resolveSources', () => {
  const board = (): LanesBoard => ({
    gameId: 'gtai', readAt: '', configured: true,
    roots: [
      { root: path.resolve('/k/gtai-eve'), name: 'gtai-eve', ok: true, lanes: [
        { id: 'gunplay', cwd: '/w/e-gunplay', cwdExists: true, branch: 'e-gunplay' }, { id: 'arena', cwd: '/w/e-arena', cwdExists: false },
      ] as never },
      { root: path.resolve('/k/gtai-night'), name: 'gtai-night', ok: true, lanes: [{ id: 'night', cwd: '/w/n', cwdExists: true }] as never },
    ],
  });
  it('auto = game root then the configured root\'s lanes that exist; a lane in another root is not searched', () => {
    const s = resolveSources(CFG, '/g', board(), 'auto');
    expect(s?.selected.map((x) => x.id)).toEqual(['main', 'gunplay']);
    expect(s?.pickable.map((x) => x.id)).toEqual(['auto', 'main', 'gunplay']);
  });
  it('adds the engine user:// folder as a telemetry-only source when it exists, and tables never come from it', () => {
    const appData = tmp();
    put(appData, 'RTAI Uprising/arena/s9.json', { hit_rate: 0.7 });
    put(appData, 'RTAI Uprising/project/data/tables/weapons.json', { pistol: { damage: 1 } });
    const cfg = { ...CFG, userData: { appDataFolder: 'RTAI Uprising', telemetryDirs: ['arena'] } };
    const s = resolveSources(cfg, '/g', board(), 'auto', appData)!;
    expect(s.selected.map((x) => x.id)).toEqual(['main', 'gunplay', 'userdata']);
    expect(readSessions(cfg.telemetryDirs, s.selected, 0).map((x) => x.file)).toEqual(['s9.json']);
    expect(readTable('weapons', cfg.tables.weapons, s.selected)).toMatchObject({ state: 'missing' });
    expect(resolveSources(cfg, '/g', board(), 'auto', path.join(appData, 'nope'))!.selected.map((x) => x.id)).toEqual(['main', 'gunplay']);
  });
  it('picks one source, and refuses an unknown or absent one', () => {
    expect(resolveSources(CFG, '/g', board(), 'gunplay')?.selected.map((x) => x.id)).toEqual(['gunplay']);
    expect(resolveSources(CFG, '/g', board(), 'arena')).toBeNull();
    expect(resolveSources(CFG, '/g', board(), 'night')).toBeNull();
    expect(resolveSources(CFG, null, board(), 'main')).toBeNull();
  });
});
