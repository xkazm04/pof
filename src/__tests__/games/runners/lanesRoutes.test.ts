/**
 * `/api/games/[gameId]/lanes` and `/lanes/frame`: the reader runs over a throwaway fixture (never the real runner
 * roots) named through the env overrides. The frame door serves only what a lane's frames.json lists.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as LANES } from '@/app/api/games/[gameId]/lanes/route';
import { GET as FRAME } from '@/app/api/games/[gameId]/lanes/frame/route';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-lanes-route-'));
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const saved = { roots: process.env.POF_GAME_RUNNER_ROOTS_GTAI, masters: process.env.POF_GAME_MASTERS_GTAI };

const w = (rel: string, body: string | Buffer) => {
  const f = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
};

beforeAll(() => {
  w('root/night.json', JSON.stringify({ lanes: [{ id: 'lane-a', cwd: path.join(tmp, 'wt'), brief: 'b.md' }] }));
  fs.mkdirSync(path.join(tmp, 'wt'));
  w('masters/day/lane-a/ok.png', PNG);
  w('masters/day/lane-a/unlisted.png', PNG);
  w('masters/day/lane-a/frames.json', JSON.stringify([{ file: 'ok.png', title: 'OK', before: 'ok.png' }, { file: '../../root/night.json', title: 'x' }]));
  w('masters/day/lane-b/frames.json', '[]');
  w('secret.png', PNG);
  process.env.POF_GAME_RUNNER_ROOTS_GTAI = path.join(tmp, 'root');
  process.env.POF_GAME_MASTERS_GTAI = path.join(tmp, 'masters');
});
afterAll(() => {
  if (saved.roots === undefined) delete process.env.POF_GAME_RUNNER_ROOTS_GTAI; else process.env.POF_GAME_RUNNER_ROOTS_GTAI = saved.roots;
  if (saved.masters === undefined) delete process.env.POF_GAME_MASTERS_GTAI; else process.env.POF_GAME_MASTERS_GTAI = saved.masters;
  fs.rmSync(tmp, { recursive: true, force: true });
});

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) });
const get = (route: (req: NextRequest, c: ReturnType<typeof ctx>) => Promise<Response>, gameId: string, q = '') => route(new NextRequest(`http://localhost/api/games/${gameId}/lanes${q}`), ctx(gameId));
const frame = (lane: string, file: string) => get(FRAME, 'gtai', `/frame?lane=${encodeURIComponent(lane)}&file=${encodeURIComponent(file)}`);

describe('GET /api/games/[gameId]/lanes', () => {
  it('returns the board in the {success,data} envelope', async () => {
    const res = await get(LANES, 'gtai');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ gameId: 'gtai', configured: true, masters: path.join(tmp, 'masters') });
    const lane = body.data.roots[0].lanes[0];
    expect(lane).toMatchObject({ id: 'lane-a', state: 'pending', iterations: 0, cwdExists: true });
    expect(lane.frames).toEqual([expect.objectContaining({ file: 'ok.png', title: 'OK', url: '/api/games/gtai/lanes/frame?lane=lane-a&file=ok.png' })]);
  });
  it('an unknown game is 404; a game with no runners is a configured:false payload', async () => {
    expect((await get(LANES, 'nope')).status).toBe(404);
    const pof = await (await get(LANES, 'pof')).json();
    expect(pof.data).toMatchObject({ configured: false, roots: [] });
  });
});

describe('GET /api/games/[gameId]/lanes/frame', () => {
  it('serves a frame the lane lists', async () => {
    const res = await frame('lane-a', 'ok.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });
  it('refuses a file the lane does not list, even though it exists beside it', async () => {
    const res = await frame('lane-a', 'unlisted.png');
    expect(res.status).toBe(404);
    expect((await res.json()).success).toBe(false);
  });
  it('refuses traversal, absolute paths, non-images and bad lane ids', async () => {
    for (const [lane, file] of [['lane-a', '../../secret.png'], ['lane-a', '../../root/night.json'], ['lane-a', path.join(tmp, 'secret.png')], ['lane-a', 'frames.json'], ['../lane-a', 'ok.png'], ['lane-a', ''], ['', 'ok.png']] as const) {
      expect([400, 404], `${lane} ${file}`).toContain((await frame(lane, file)).status);
    }
    expect((await frame('lane-a', '../../secret.png')).status).toBe(400);
  });
  it('a lane with no frames.json serves nothing; an unknown game is 404', async () => {
    expect((await frame('lane-z', 'ok.png')).status).toBe(404);
    expect((await get(FRAME, 'nope', '/frame?lane=lane-a&file=ok.png')).status).toBe(404);
  });
});
