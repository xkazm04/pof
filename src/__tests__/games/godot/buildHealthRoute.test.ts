/**
 * F-10: `GET /api/games/[gameId]/build-health` over a temp game root (`POF_GAME_ROOT_GTAI`).
 * Every evidence kind is one row; pass, fail, stale and absent read honestly; the aggregate is the
 * worst of them; a non-Godot game and a root not on disk are `unbound` payloads, never errors.
 * The game HEAD is injected (the temp folder is not a git repo); `gitHeadOf` itself is covered by
 * readEvidence.test.ts.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import type { BuildHealth } from '@/lib/games/godot/buildHealthTypes';
import { benchReadings, buildHealthState, ageText } from '@/lib/games/godot/buildHealthTypes';
import { GODOT_EVIDENCE_KINDS } from '@/lib/games/godot/evidenceTypes';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const inject = vi.hoisted(() => ({ head: null as string | null, calls: 0 }));
vi.mock('@/lib/games/godot/readEvidence', async (orig) => ({
  ...(await orig<typeof import('@/lib/games/godot/readEvidence')>()),
  gitHeadOf: () => { inject.calls += 1; return inject.head; },
}));

import { GET } from '@/app/api/games/[gameId]/build-health/route';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-build-health-'));
const EVID = path.join(ROOT, 'build', 'evidence');
const prev = process.env.POF_GAME_ROOT_GTAI;

const write = (kind: string, over: Record<string, unknown> = {}) => fs.writeFileSync(path.join(EVID, `${kind}.json`), JSON.stringify({
  schema: 'pof.godot-evidence/1', kind, gameId: 'gtai', commit: HEAD, builtAt: '2026-11-02T10:00:00.000Z',
  godotVersion: '4.7.2', status: 'pass', summary: `${kind} ok`, ...over,
}));

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) });
async function get(gameId = 'gtai'): Promise<{ status: number; body: { success: boolean; data: BuildHealth; error?: string } }> {
  const res = await GET(new NextRequest(`http://localhost/api/games/${gameId}/build-health`), ctx(gameId));
  return { status: res.status, body: await res.json() };
}
const row = (d: BuildHealth, kind: string) => d.rows.find((r) => r.kind === kind)!;

beforeEach(() => {
  process.env.POF_GAME_ROOT_GTAI = ROOT;
  fs.rmSync(EVID, { recursive: true, force: true });
  fs.mkdirSync(EVID, { recursive: true });
  inject.head = HEAD;
  inject.calls = 0;
});
afterAll(() => {
  if (prev === undefined) delete process.env.POF_GAME_ROOT_GTAI; else process.env.POF_GAME_ROOT_GTAI = prev;
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe('GET /api/games/[gameId]/build-health', () => {
  it('reads every kind once against one HEAD: pass, fail, stale and absent', async () => {
    write('lint', { counts: { passed: 12, failed: 0, skipped: 0 } });
    write('unit-tests', { status: 'fail', summary: '2 failing', counts: { passed: 8, failed: 2, skipped: 0 } });
    write('parity', { commit: OLD });
    write('bench', { metrics: { p99CpuMs: 3.1, low1Fps: 140, worstSwapMs: 61, worstFrameMs: 70 } });
    const { status, body } = await get();
    expect(status).toBe(200);
    const d = body.data;
    expect(d).toMatchObject({ gameId: 'gtai', engine: 'godot', binding: 'bound', head: HEAD });
    expect(d.root).toBe(path.resolve(ROOT));
    expect(d.rows.map((r) => r.kind)).toEqual([...GODOT_EVIDENCE_KINDS]);
    expect(inject.calls).toBe(1);
    expect(row(d, 'lint')).toMatchObject({ status: 'pass', state: 'pass', commit: HEAD, builtAt: '2026-11-02T10:00:00.000Z', counts: { passed: 12, failed: 0, skipped: 0 } });
    expect(row(d, 'unit-tests')).toMatchObject({ status: 'fail', state: 'fail' });
    expect(row(d, 'parity')).toMatchObject({ status: 'deferred', state: 'stale', commit: OLD });
    expect(row(d, 'parity').reason).toMatch(/^stale: evidence from bbbbbbb, HEAD aaaaaaa/);
    expect(row(d, 'selftest')).toMatchObject({ status: 'deferred', state: 'absent' });
    expect(row(d, 'selftest').builtAt).toBeUndefined();
    expect(row(d, 'bench').metrics).toEqual({ p99CpuMs: 3.1, low1Fps: 140, worstSwapMs: 61, worstFrameMs: 70 });
    expect(d.aggregate).toEqual({ status: 'fail', total: 8, pass: 2, fail: 1, stale: 1, absent: 4, deferred: 0 });
  });

  it('a malformed file is a fail; an unknown HEAD defers every present file', async () => {
    fs.writeFileSync(path.join(EVID, 'lint.json'), '{ not json');
    write('unit-tests');
    inject.head = null;
    const d = (await get()).body.data;
    expect(row(d, 'lint')).toMatchObject({ status: 'fail', state: 'fail' });
    expect(row(d, 'unit-tests')).toMatchObject({ status: 'deferred', state: 'deferred' });
    expect(d.head).toBeNull();
  });

  it('all eight kinds passing aggregates to pass', async () => {
    for (const k of GODOT_EVIDENCE_KINDS) write(k);
    expect((await get()).body.data.aggregate).toMatchObject({ status: 'pass', pass: 8 });
  });

  it('a root that is not on disk is an honest unbound payload naming the env var', async () => {
    process.env.POF_GAME_ROOT_GTAI = path.join(ROOT, 'nope');
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ binding: 'unbound', root: null, head: null, rows: [], aggregate: { status: 'unbound', total: 0 } });
    expect(body.data.reason).toMatch(/POF_GAME_ROOT_GTAI=.*is not on disk/);
  });

  it('a non-Godot game is unbound, not an error; an unknown game is a 404', async () => {
    const pof = await get('pof');
    expect(pof.status).toBe(200);
    expect(pof.body.data).toMatchObject({ gameId: 'pof', engine: 'ue5', binding: 'unbound' });
    expect(pof.body.data.reason).toMatch(/not a Godot game/);
    expect((await get('nope')).status).toBe(404);
  });
});

describe('build-health pure helpers', () => {
  it('names the display state', () => {
    expect(buildHealthState('deferred', 'no evidence yet: x', false)).toBe('absent');
    expect(buildHealthState('deferred', 'stale: evidence from a, HEAD b', true)).toBe('stale');
    expect(buildHealthState('deferred', 'cannot read the game HEAD', true)).toBe('deferred');
    expect(buildHealthState('fail', undefined, false)).toBe('fail');
  });

  it('judges bench metrics against the STANDARDS section 20 hard limits', () => {
    const by = (m: Record<string, number> | undefined) => Object.fromEntries(benchReadings(m).map((r) => [r.key, r.verdict]));
    expect(by({ p99CpuMs: 7, low1Fps: 45.1, worstSwapMs: 50, worstFrameMs: 80 }))
      .toEqual({ p99CpuMs: 'within', low1Fps: 'within', worstSwapMs: 'within', worstFrameMs: 'unbudgeted' });
    expect(by({ p99CpuMs: 7.01, low1Fps: 45, worstSwapMs: 50.5 }))
      .toEqual({ p99CpuMs: 'over', low1Fps: 'over', worstSwapMs: 'over', worstFrameMs: 'missing' });
    expect(by(undefined).p99CpuMs).toBe('missing');
  });

  it('dates evidence against the read time, never a clock', () => {
    expect(ageText('2026-11-02T10:00:00Z', '2026-11-02T10:30:00Z')).toBe('30 min ago');
    expect(ageText('2026-11-02T10:00:00Z', '2026-11-02T15:00:00Z')).toBe('5 h ago');
    expect(ageText('2026-10-28T10:00:00Z', '2026-11-02T10:00:00Z')).toBe('5 d ago');
    expect(ageText(undefined, '2026-11-02T10:00:00Z')).toBeNull();
    expect(ageText('garbage', '2026-11-02T10:00:00Z')).toBeNull();
  });
});
