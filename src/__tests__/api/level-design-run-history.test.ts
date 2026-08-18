/**
 * The generation run ledger.
 *
 * `procgen_runs` held room count + seed, only the newest row was queryable, and
 * a FAILED run never POSTed at all — so it left no trace whatsoever. These tests
 * pin the four things that fixes: history is readable, a run carries what it
 * actually was (algorithm/params/doc), a failure is a visible row WITH its
 * reason, and the legacy `getLatest*Run` shape still works.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { NextRequest } from 'next/server';
import { GET as procgenGET, POST as procgenPOST } from '@/app/api/level-design/procgen-result/route';
import { GET as scatterGET, POST as scatterPOST } from '@/app/api/level-design/scatter-result/route';
import { getLatestProcgenRun, listProcgenRuns } from '@/lib/procgen-db';
import { listScatterRuns } from '@/lib/scatter-db';
import type { ProcgenRun, ScatterRun } from '@/types/procgen';

const PROCGEN = 'http://localhost/api/level-design/procgen-result';
const SCATTER = 'http://localhost/api/level-design/scatter-result';

function req(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function post(
  handler: (r: NextRequest) => Promise<Response>,
  url: string,
  body: unknown,
) {
  const res = await handler(req(url, body));
  return { status: res.status, body: await res.json() };
}

async function get(handler: (r: NextRequest) => Promise<Response>, url: string) {
  const res = await handler(new NextRequest(url));
  return { status: res.status, body: await res.json() };
}

describe('a run records what it actually was', () => {
  it('persists algorithm, params, doc link and map path — not just count + seed', async () => {
    const { status, body } = await post(procgenPOST, PROCGEN, {
      roomCount: 9,
      seed: 4242,
      algorithm: 'ARPGLevelGenerator',
      params: { moduleId: 'level-design', roomCountRequested: 10 },
      docId: 7,
      mapPath: '/Game/Maps/ProcGenDungeon',
    });

    expect(status).toBe(201);
    const run = body.data as ProcgenRun;
    expect(run.roomCount).toBe(9);
    expect(run.algorithm).toBe('ARPGLevelGenerator');
    expect(run.params).toEqual({ moduleId: 'level-design', roomCountRequested: 10 });
    expect(run.docId).toBe(7);
    expect(run.mapPath).toBe('/Game/Maps/ProcGenDungeon');
    expect(run.success).toBe(true);
    expect(run.failureReason).toBe('');
  });

  it('keeps the legacy latest-run shape for existing consumers', async () => {
    await post(procgenPOST, PROCGEN, { roomCount: 3, seed: 11 });
    const latest = getLatestProcgenRun()!;
    expect(latest.roomCount).toBe(3);
    expect(latest.seed).toBe(11);
    expect(typeof latest.createdAt).toBe('string');

    const { body } = await get(procgenGET, PROCGEN);
    expect(body.data.roomCount).toBe(3);
  });
});

describe('history is reachable, and reroll is survivable', () => {
  it('returns runs newest-first so an earlier seed is still recoverable', async () => {
    await post(procgenPOST, PROCGEN, { roomCount: 4, seed: 1001 });
    await post(procgenPOST, PROCGEN, { roomCount: 6, seed: 2002 });

    const { body } = await get(procgenGET, `${PROCGEN}?history=1`);
    const runs = body.data.runs as ProcgenRun[];
    expect(runs[0].seed).toBe(2002);
    // The seed replaced by the re-roll is still here — that IS the memory.
    expect(runs.map((r) => r.seed)).toContain(1001);
  });

  it('narrows to one design document when asked', async () => {
    await post(procgenPOST, PROCGEN, { roomCount: 5, seed: 501, docId: 42 });
    await post(procgenPOST, PROCGEN, { roomCount: 5, seed: 502, docId: 43 });

    const { body } = await get(procgenGET, `${PROCGEN}?history=1&docId=42`);
    const runs = body.data.runs as ProcgenRun[];
    expect(runs.every((r) => r.docId === 42)).toBe(true);
    expect(runs.some((r) => r.seed === 501)).toBe(true);
  });

  it('clamps a hostile limit instead of trusting it', async () => {
    expect(listProcgenRuns({ limit: 1 })).toHaveLength(1);
    expect(listProcgenRuns({ limit: 99999 }).length).toBeLessThanOrEqual(100);
    expect(listProcgenRuns({ limit: 'abc' }).length).toBeGreaterThan(0);
  });
});

describe('a failed run is a row, not a silence', () => {
  it('stores the failure with its reason and does not claim a count', async () => {
    const { status, body } = await post(procgenPOST, PROCGEN, {
      seed: 777,
      success: false,
      failureReason: 'ARPGLevelGenerator: no room templates in the pool',
      docId: 7,
    });

    expect(status).toBe(201);
    const run = body.data as ProcgenRun;
    expect(run.success).toBe(false);
    expect(run.failureReason).toMatch(/no room templates/);
    expect(run.roomCount).toBe(0);

    const { body: hist } = await get(procgenGET, `${PROCGEN}?history=1`);
    const failed = (hist.data.runs as ProcgenRun[]).find((r) => r.seed === 777)!;
    expect(failed.success).toBe(false);
    expect(failed.failureReason).toMatch(/no room templates/);
  });

  it('REFUSES a failure with no reason — that is the vanished run all over again', async () => {
    const { status, body } = await post(procgenPOST, PROCGEN, { seed: 3, success: false });
    expect(status).toBe(400);
    expect(body.error).toMatch(/failureReason is required/);
  });

  it('REFUSES a successful run with no count, and a run with no seed', async () => {
    expect((await post(procgenPOST, PROCGEN, { seed: 5 })).body.error).toMatch(/roomCount is required/);
    expect((await post(procgenPOST, PROCGEN, { roomCount: 5 })).body.error).toMatch(/seed is required/);
    expect((await post(procgenPOST, PROCGEN, { roomCount: 5, seed: 1, docId: 0 })).body.error)
      .toMatch(/docId must be a positive integer/);
  });
});

describe('the scatter ledger follows the same contract', () => {
  it('records instances, provenance and failures alike', async () => {
    await post(scatterPOST, SCATTER, {
      instanceCount: 120,
      seed: 88,
      algorithm: 'AARPGVegetationScatter',
      params: { density: 1.5 },
      docId: 7,
    });
    await post(scatterPOST, SCATTER, {
      seed: 89,
      success: false,
      failureReason: 'scatter_biome_ue.py: arena floor actor not found',
    });

    const { body } = await get(scatterGET, `${SCATTER}?history=1`);
    const runs = body.data.runs as ScatterRun[];
    expect(runs[0].success).toBe(false);
    expect(runs[0].failureReason).toMatch(/arena floor actor not found/);
    const ok = runs.find((r) => r.seed === 88)!;
    expect(ok.instanceCount).toBe(120);
    expect(ok.params).toEqual({ density: 1.5 });
    expect(listScatterRuns({ docId: 7 }).some((r) => r.seed === 88)).toBe(true);
  });
});
