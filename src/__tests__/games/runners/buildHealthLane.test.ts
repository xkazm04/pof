/**
 * `GET /api/games/gtai/build-health?lane=<id>`: the lanes control room picks a lane worktree's `build/evidence/`.
 * The lane is resolved through the configured runner roots (env fixture here); an id the board does not know is 404,
 * so a path can never be named from the query. The HEAD is injected (the fixture is not a git repo).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { BuildHealth } from '@/lib/games/godot/buildHealthTypes';

const HEAD = 'c'.repeat(40);
vi.mock('@/lib/games/godot/readEvidence', async (orig) => ({
  ...(await orig<typeof import('@/lib/games/godot/readEvidence')>()),
  gitHeadOf: () => HEAD,
}));

import { GET } from '@/app/api/games/[gameId]/build-health/route';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-bh-lane-'));
const env = ['POF_GAME_RUNNER_ROOTS_GTAI', 'POF_GAME_MASTERS_GTAI', 'POF_GAME_ROOT_GTAI'] as const;
const saved = Object.fromEntries(env.map((k) => [k, process.env[k]]));

beforeAll(() => {
  const wt = path.join(tmp, 'wt');
  fs.mkdirSync(path.join(wt, 'build', 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(wt, 'build', 'evidence', 'lint.json'), JSON.stringify({
    schema: 'pof.godot-evidence/1', kind: 'lint', gameId: 'gtai', commit: HEAD, builtAt: '2026-11-03T09:00:00.000Z', godotVersion: '4.7.2', status: 'fail', summary: 'lane lint red',
  }));
  fs.mkdirSync(path.join(tmp, 'root'));
  fs.writeFileSync(path.join(tmp, 'root', 'night.json'), JSON.stringify({ lanes: [{ id: 'lane-a', cwd: wt, brief: 'b.md' }, { id: 'lane-gone', cwd: path.join(tmp, 'gone'), brief: 'b.md' }] }));
  process.env.POF_GAME_RUNNER_ROOTS_GTAI = path.join(tmp, 'root');
  delete process.env.POF_GAME_ROOT_GTAI;
});
afterAll(() => {
  for (const k of env) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  fs.rmSync(tmp, { recursive: true, force: true });
});

const get = async (q: string) => {
  const res = await GET(new NextRequest(`http://localhost/api/games/gtai/build-health${q}`), { params: Promise.resolve({ gameId: 'gtai' }) });
  return { status: res.status, body: (await res.json()) as { success: boolean; data: BuildHealth; error?: string } };
};

describe('build-health ?lane=', () => {
  it('reads the lane worktree evidence and names the lane', async () => {
    const { status, body } = await get('?lane=lane-a');
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ lane: 'lane-a', binding: 'bound', root: path.join(tmp, 'wt'), head: HEAD });
    expect(body.data.rows.find((r) => r.kind === 'lint')).toMatchObject({ status: 'fail', detail: expect.stringContaining('lane lint red') });
    expect(body.data.aggregate.status).toBe('fail');
  });
  it('an unknown lane, or one whose worktree is gone, is a 404; a path in the query is just an unknown lane', async () => {
    for (const q of ['?lane=nope', '?lane=lane-gone', `?lane=${encodeURIComponent(path.join(tmp, 'wt'))}`]) {
      const { status, body } = await get(q);
      expect(status, q).toBe(404);
      expect(body.success).toBe(false);
    }
  });
  it('without ?lane= the payload carries no lane key (the game root, as before)', async () => {
    const { body } = await get('');
    expect(body.data).not.toHaveProperty('lane');
  });
});
