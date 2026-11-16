import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStations, stationOf } from '@/lib/games/combatLab/readStations';
import type { SourceDir } from '@/lib/games/combatLab/readCombatLab';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
function root(files: Record<string, unknown | string>): SourceDir {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-stations-'));
  dirs.push(d);
  const dir = path.join(d, 'tables', 'arena_stations');
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), typeof body === 'string' ? body : JSON.stringify(body));
  return { id: 'main', label: 'game root (main)', root: d };
}
const FROM = { id: 'main', label: 'game root (main)' };

describe('stationOf', () => {
  it('counts lists and maps by key name, and omits what the file lacks (never 0)', () => {
    const s = stationOf('arena.json', FROM, { id: 'range', name: 'Range', area: 'range', spawn_list: [1, 2, 3], props: { a: 1 }, tuning_keys: [], measurements_reported: ['ttk'] });
    expect(s).toMatchObject({ id: 'range', name: 'Range', area: 'range', spawns: 3, props: 1, tuningKeys: 0, measurements: 1 });
    const bare = stationOf('x.json', FROM, { id: 'x' });
    expect(bare).not.toHaveProperty('spawns');
    expect(bare).not.toHaveProperty('props');
  });
  it('survives a non-object document', () => { expect(stationOf('x.json', FROM, [1, 2])).toEqual({ file: 'x.json', from: FROM }); });
});

describe('readStations', () => {
  it('lists every json file, flags unreadable ones, ignores other files', () => {
    const src = root({ 'arena.json': { id: 'range', spawns: [1] }, 'gunplay.json': '{ nope', 'notes.txt': 'x' });
    const r = readStations('tables/arena_stations', [src]);
    expect(r.items.map((i) => i.file)).toEqual(['arena.json', 'gunplay.json']);
    expect(r.items[0].spawns).toBe(1);
    expect(r.items[1].unreadable).toBe(true);
  });
  it("expands a lane file's stations array into one row per station (the lanes' real shape)", () => {
    const src = root({
      'arena.json': { lane: 'arena', schema: 'gtai.arena-station/1', stations: [
        { id: 'range', name: 'Range', area: 'range', spawns: [1, 2, 3], props: [1], tuning: [1, 2], measures: ['ttk'] },
        { id: 'pit', name: 'Pit', area: 'pit', spawns: [1], props: [], tuning: [], measures: [] },
      ] },
      'enemy-ai.json': { stations: [{ id: 'enemy_pit', kind: 'pit', script: 'x.gd' }] },
    });
    const r = readStations('tables/arena_stations', [src]);
    expect(r.items.map((i) => [i.file, i.id])).toEqual([['arena.json', 'range'], ['arena.json', 'pit'], ['enemy-ai.json', 'enemy_pit']]);
    expect(r.items[0]).toMatchObject({ spawns: 3, props: 1, tuningKeys: 2, measurements: 1 });
    expect(r.items[2]).toMatchObject({ area: 'pit' }); // kind stands in for a missing area
    expect(r.items[2]).not.toHaveProperty('spawns');
  });
  it('lists a station once when two worktrees carry the same lane file, preferring the owning lane', () => {
    const body = { stations: [{ id: 'gearbox', name: 'Gearbox', area: 'pad', spawns: [1] }] };
    const a = { ...root({ 'ghost-powers.json': body }), id: 'arena', label: 'lane arena (e-arena)' };
    const b = { ...root({ 'ghost-powers.json': body }), id: 'ghost-powers', label: 'lane ghost-powers (e-powers)' };
    const r = readStations('tables/arena_stations', [a, b]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].from.id).toBe('ghost-powers');
    expect(readStations('tables/arena_stations', [a]).items[0].from.id).toBe('arena');
  });
  it('says where stations are expected when there are none, and skips the user:// source', () => {
    const r = readStations('tables/arena_stations', [{ id: 'userdata', label: 'engine user://', root: os.tmpdir(), telemetryDirs: ['x'] }]);
    expect(r.items).toEqual([]);
    expect(r.expected).toContain('tables/arena_stations');
  });
});
