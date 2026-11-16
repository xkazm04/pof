/**
 * The Combat lab over a stubbed fetch: a measured time-to-kill chart (fastest per range highlighted), the tables with
 * their source, a missing table saying where it is expected, a session row that does not invent zeros, the source
 * picker re-reading with its choice, and the honest empty states.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CombatLabRoom } from '@/components/layout-lab/game/combat/combatLabRoom';
import { ttkRows } from '@/components/layout-lab/game/combat/combatTtkChart';
import { sessionRow } from '@/components/layout-lab/game/combat/combatSessions';
import { isCombatRead } from '@/components/layout-lab/game/combat/combatLabData';
import { LIGHT } from '@/components/layout-lab/theme';
import type { CombatLabRead, TelemetrySession } from '@/lib/games/combatLab/combatTypes';

const session = (over: Partial<TelemetrySession> = {}): TelemetrySession => ({
  file: 's1.json', from: { id: 'main', label: 'game root (main)' }, mtimeMs: 1, ageMs: 125_000, metrics: [{ key: 'hitRate', value: 0.58 }],
  ttk: [{ weapon: 'pistol', rangeM: 5, seconds: 1.1 }, { weapon: 'shotgun', rangeM: 5, seconds: 0.6 }, { weapon: 'pistol', rangeM: 10, seconds: 1.8 }], other: {}, ...over,
});
const read = (over: Partial<CombatLabRead> = {}): CombatLabRead => ({
  gameId: 'gtai', readAt: '2026-11-03T19:30:00Z', configured: true, source: 'auto',
  sources: [{ id: 'auto', label: 'auto' }, { id: 'main', label: 'game root (main)' }, { id: 'gunplay', label: 'lane gunplay' }],
  tables: [
    { key: 'weapons', state: 'ok', file: 'project/data/tables/weapons.json', from: { id: 'gunplay', label: 'lane gunplay' }, columns: ['damage'], hiddenColumns: 0, rows: [{ label: 'pistol', values: { damage: 12 } }] },
    { key: 'enemies', state: 'missing', file: 'project/data/tables/enemies.json', reason: 'not in game root (main); expected at project/data/tables/enemies.json', columns: [], hiddenColumns: 0, rows: [] },
    { key: 'powers', state: 'invalid', file: 'p.json', reason: 'unparseable JSON: x', columns: [], hiddenColumns: 0, rows: [] },
  ],
  telemetry: { dirs: ['d'], sessions: [session()], expected: 'one JSON file per arena session in d' }, ...over,
});

type Res = { success: boolean; data?: unknown; error?: string };
function stubFetch(res: (url: string) => Res) {
  const fn = vi.fn((url: string) => Promise.resolve({ json: () => Promise.resolve(res(url)) }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const room = () => render(<CombatLabRoom t={LIGHT} gameId="gtai" />);

describe('Combat lab', () => {
  it('ttkRows sorts by range then time and highlights the fastest at each range', () => {
    const rows = ttkRows(session().ttk);
    expect(rows.map((r) => r.label)).toEqual(['5 m · shotgun', '5 m · pistol', '10 m · pistol']);
    expect(rows.map((r) => r.highlight)).toEqual([true, false, true]);
  });

  it('sessionRow shows what was recorded and "not recorded" for the rest, never a zero', () => {
    const row = sessionRow(session());
    expect(row.values).toMatchObject({ hitRate: 0.58, dodges: 'not recorded', damageTaken: 'not recorded', age: '2m 5s ago', ttkPoints: 3 });
    const other = sessionRow(session({ metrics: [], ttk: [], other: { build: 'dev' } }));
    expect(other.values).toMatchObject({ build: 'dev' });
  });

  it('rounds logged floats to two decimals, and shows pit/course columns only once a session has them', async () => {
    const row = sessionRow(session({ metrics: [{ key: 'hitRate', value: 0.3870967741935484 }, { key: 'damageTaken', value: 4.199999999999996 }, { key: 'turnRate', value: 720.000327394338 }] }));
    expect(row.values).toMatchObject({ hitRate: 0.39, damageTaken: 4.2, turnRate: 720 });
    stubFetch(() => ({ success: true, data: read() }));
    room();
    await screen.findByTestId('combat-sessions');
    expect(screen.getByTestId('combat-sessions').textContent).not.toMatch(/Pit time|Course time/);
    cleanup();
    stubFetch(() => ({ success: true, data: read({ telemetry: { dirs: ['d'], expected: 'x', sessions: [session({ metrics: [{ key: 'pitTime', value: 12.4 }, { key: 'pitKills', value: 5 }] })] } }) }));
    room();
    await screen.findByTestId('combat-sessions');
    expect(screen.getByTestId('combat-sessions').textContent).toMatch(/Pit time/);
  });

  it('renders the chart, the table with its source, and missing / unreadable tables with the reason', async () => {
    stubFetch(() => ({ success: true, data: read() }));
    room();
    await screen.findByTestId('combat-ttk');
    expect(screen.getByTestId('combat-ttk').textContent).toContain('s1.json');
    expect(screen.getByTestId('combat-source-weapons').textContent).toContain('read from lane gunplay');
    expect(screen.getByTestId('combat-grid-weapons').textContent).toContain('pistol');
    expect(screen.getByTestId('combat-table-enemies').textContent).toContain('expected at project/data/tables/enemies.json');
    expect(screen.getByTestId('combat-table-enemies').getAttribute('data-state')).toBe('missing');
    expect(screen.getByTestId('combat-table-powers').textContent).toContain('unparseable JSON');
    expect(screen.getByTestId('combat-sessions').textContent).toContain('not recorded');
  });

  it('lists the arena stations, "not in file" for an absent count, and says where they are expected when none', async () => {
    const from = { id: 'gunplay', label: 'lane gunplay' };
    stubFetch(() => ({ success: true, data: read({ stations: { dir: 'project/data/tables/arena_stations', expected: 'x', items: [{ file: 'gunplay.json', from, name: 'Range', area: 'range', spawns: 4 }] } }) }));
    room();
    const grid = await screen.findByTestId('combat-grid-stations');
    expect(grid.textContent).toContain('Range');
    expect(grid.textContent).toContain('— not in file');
    expect(screen.getByTestId('combat-stations').getAttribute('data-count')).toBe('1');
    cleanup();
    stubFetch(() => ({ success: true, data: read({ stations: { dir: 'd', expected: 'one JSON file per lane in STATIONS-DIR', items: [] } }) }));
    room();
    expect((await screen.findByTestId('combat-stations')).textContent).toContain('STATIONS-DIR');
  });

  it('says so with no telemetry and with sessions that recorded no time to kill', async () => {
    stubFetch(() => ({ success: true, data: read({ telemetry: { dirs: [], sessions: [], expected: 'EXPECTED-PATH' } }) }));
    room();
    expect((await screen.findByTestId('combat-ttk-empty')).textContent).toContain('EXPECTED-PATH');
    expect(screen.getByTestId('combat-sessions-empty').textContent).toContain('No telemetry session yet');
    cleanup();
    stubFetch(() => ({ success: true, data: read({ telemetry: { dirs: [], sessions: [session({ ttk: [] })], expected: 'x' } }) }));
    room();
    expect((await screen.findByTestId('combat-ttk-empty')).textContent).toContain('none recorded a time to kill');
  });

  it('re-reads with the picked source', async () => {
    const fn = stubFetch(() => ({ success: true, data: read() }));
    room();
    const sel = (await screen.findByTestId('combat-source')) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'gunplay' } });
    await waitFor(() => expect(fn.mock.calls.some(([u]) => String(u).endsWith('combat-lab?source=gunplay'))).toBe(true));
  });

  it('a switch to a failing source shows no tables of the previous source, and keeps the picker', async () => {
    stubFetch((url) => (url.endsWith('source=gunplay') ? { success: false, error: 'lane down' } : { success: true, data: read() }));
    room();
    const sel = (await screen.findByTestId('combat-source')) as HTMLSelectElement;
    await screen.findByTestId('combat-grid-weapons');
    fireEvent.change(sel, { target: { value: 'gunplay' } });
    await screen.findByText(/combat lab unavailable \(lane down\)/);
    expect(screen.queryByTestId('combat-grid-weapons')).toBeNull();
    expect(screen.queryByText(/Showing the last read/)).toBeNull();
    expect(screen.getByTestId('combat-source')).toBeTruthy();
  });

  it('shows an unconfigured game, a failed read, and rejects a malformed response', async () => {
    stubFetch(() => ({ success: true, data: read({ configured: false, reason: 'x declares no combat lab', tables: [] }) }));
    room();
    expect((await screen.findByTestId('combat-unconfigured')).textContent).toContain('declares no combat lab');
    cleanup();
    stubFetch(() => ({ success: false, error: 'boom' }));
    room();
    expect((await screen.findByText(/combat lab unavailable \(boom\)/)).textContent).toContain('boom');
    expect(isCombatRead({ configured: true })).toBe(false);
    expect(isCombatRead(read())).toBe(true);
  });
});
