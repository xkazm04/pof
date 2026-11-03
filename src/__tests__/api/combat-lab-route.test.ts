import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/games/[gameId]/combat-lab/route';

const ENV = ['POF_GAME_ROOT_GTAI', 'POF_GAME_RUNNER_ROOTS_GTAI', 'APPDATA'] as const;
const prev = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
let base = '';
const call = (gameId: string, q = '') => GET(new NextRequest(`http://localhost/api/games/${gameId}/combat-lab${q}`), { params: Promise.resolve({ gameId }) });
const body = async (r: Response) => (await r.json()) as { success: boolean; data?: { tables: Array<{ key: string; state: string; from?: { id: string } }>; sources: Array<{ id: string }>; telemetry: { sessions: unknown[] } }; error?: string };

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-combat-route-'));
  const main = path.join(base, 'main');
  const lane = path.join(base, 'wt', 'e-gunplay');
  const eve = path.join(base, 'gtai-eve');
  for (const d of [path.join(main, 'project/data/tables'), path.join(lane, 'project/data/tables'), eve]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(main, 'project/data/tables/enemies.json'), JSON.stringify([{ id: 'thug', hp: 1 }]));
  fs.writeFileSync(path.join(lane, 'project/data/tables/weapons.json'), JSON.stringify({ pistol: { damage: 12 } }));
  fs.writeFileSync(path.join(eve, 'night.json'), JSON.stringify({ common: 'x', lanes: [{ id: 'gunplay', cwd: lane, brief: 'x', model: 'm', effort: 'high', iterMin: 45 }] }));
  process.env.POF_GAME_ROOT_GTAI = main;
  process.env.POF_GAME_RUNNER_ROOTS_GTAI = eve;
  process.env.APPDATA = path.join(base, 'no-appdata'); // never the machine's real user:// folder
});
afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  for (const k of ENV) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
});

describe('GET /api/games/[gameId]/combat-lab', () => {
  it('auto reads the game root then the lanes, and says which source each table came from', async () => {
    const b = await body(await call('gtai'));
    expect(b.success).toBe(true);
    const by = Object.fromEntries(b.data!.tables.map((t) => [t.key, t]));
    expect(by.enemies).toMatchObject({ state: 'ok', from: { id: 'main' } });
    expect(by.weapons).toMatchObject({ state: 'ok', from: { id: 'gunplay' } });
    expect(by.powers.state).toBe('missing');
    expect(b.data!.sources.map((s) => s.id)).toEqual(['auto', 'main', 'gunplay']);
    expect(b.data!.telemetry.sessions).toEqual([]);
  });

  it('a chosen lane reads only that lane; an unknown source or a path in the query is a 404, never read', async () => {
    const one = await body(await call('gtai', '?source=gunplay'));
    expect(one.data!.tables.map((t) => t.state)).toEqual(['ok', 'missing', 'missing', 'missing']);
    expect((await call('gtai', '?source=nope')).status).toBe(404);
    expect((await call('gtai', `?source=${encodeURIComponent(base)}`)).status).toBe(404);
  });

  it('an unknown game is 404 and a game with no combat lab says so', async () => {
    expect((await call('nope')).status).toBe(404);
    const pof = await body(await call('pof'));
    expect(pof.data).toMatchObject({ configured: false });
  });
});
