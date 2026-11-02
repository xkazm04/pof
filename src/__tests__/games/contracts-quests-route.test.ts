/**
 * `/api/games/[gameId]/quests` + `./sync` (spark gta-quest-loop, WP2): the GET ledger is derived from the
 * quest folders on every read and writes nothing; the sync mirrors each folder into the `contracts`
 * catalog (entity `gtai-<id>`, profile gtai) and persists every step through the write door with the
 * server's own verdict. Non-GTAI games have no ledger.
 *
 * Containment: DB and games root are one throwaway temp folder. The guard verdict is injected.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import type { QuestVerdict } from '@/lib/games/gtai-quest/types';

const ROOT = vi.hoisted(() => {
  const dir = `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/pof-test-contracts-${process.pid}-${Date.now()}`;
  process.env.POF_DB_PATH = `${dir}/pof.db`;
  process.env.POF_GAMES_ROOT = dir;
  delete process.env.POF_OPERATOR_TOKEN;
  return dir;
});
const inject = vi.hoisted(() => ({ verdict: null as QuestVerdict | null }));
vi.mock('@/lib/games/gtai-quest/assess', () => ({
  assessQuest: (subject: string) => inject.verdict ?? { subject, guards: [], blockedBy: [], blocked: false },
}));
vi.mock('@/lib/games/gtai-quest/loadContext', () => ({
  loadQuestContext: () => ({ economy: null, voiceBibles: new Set(), cast: new Set(), ledger: [], judge: null }),
  loadProposals: () => [{ pathId: 'claude-A', title: 'The Jam' }],
  loadLedger: () => [],
}));

import { GET } from '@/app/api/games/[gameId]/quests/route';
import { POST as SYNC } from '@/app/api/games/[gameId]/quests/sync/route';
import { deleteEntity, getEntity, listEntities } from '@/lib/catalog-db';
import { deleteArtifact, getArtifact, listArtifacts } from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';
import { verdict, writeQuest } from '@/__tests__/catalog/contractsFixture';

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) });
const url = (gameId: string, sub = '') => `http://localhost/api/games/${gameId}/quests${sub}`;
const get = async (gameId = 'gtai') => GET(new NextRequest(url(gameId)), ctx(gameId));
const sync = async (body?: unknown, gameId = 'gtai', headers: Record<string, string> = {}) =>
  SYNC(new NextRequest(url(gameId, '/sync'), { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers }), ctx(gameId));

beforeEach(() => {
  fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true });
  for (const a of listArtifacts('contracts')) deleteArtifact(a.catalogId, a.entityId, a.step);
  for (const e of listEntities('contracts')) deleteEntity(e.catalogId, e.entityId);
  inject.verdict = null;
});
afterAll(() => {
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe('GET /api/games/[gameId]/quests', () => {
  it('returns the ledger with each quest\'s verdict and step acceptance, and writes nothing', async () => {
    writeQuest(ROOT, 'fax-jam', { selftest: 'succeeded', frame: true });
    writeQuest(ROOT, 'red-tape', { judge: false, runId: null }); // one council run on disk: fax-jam's is inferable
    inject.verdict = verdict('x', { economy: 'red' });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2);
    expect(body.data.blocked).toBe(2);
    const fax = body.data.quests.find((q: { questId: string }) => q.questId === 'fax-jam');
    expect(fax.entityId).toBe('gtai-fax-jam');
    expect(fax.verdict.blockedBy).toEqual(['economy']);
    expect(fax.steps.map((s: { label: string; acceptance: { status: string } }) => [s.label, s.acceptance.status])).toEqual([
      ['Council', 'pass'], ['Plan', 'pass'], ['Guards', 'fail'], ['Package', 'pass'], ['In-game', 'pass'],
    ]);
    expect(listEntities('contracts')).toEqual([]);
  });

  it('is GTAI-only', async () => {
    expect((await get('pof')).status).toBe(404);
  });
});

describe('POST /api/games/[gameId]/quests/sync', () => {
  it('mirrors each quest into a gtai entity and persists every step with the server verdict', async () => {
    writeQuest(ROOT, 'fax-jam', { art: false });
    inject.verdict = verdict('fax-jam');
    const res = await sync();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.synced).toHaveLength(1);
    expect(data.synced[0].steps.map((s: { status: string }) => s.status)).toEqual(['pass', 'pass', 'pass', 'pending', 'deferred']);

    const entity = getEntity('contracts', 'gtai-fax-jam')!.entity;
    expect(entity.name).toBe('Quest fax-jam');
    expect(entity.provenance).toMatchObject({ kind: 'authored', canonProfile: 'gtai' });
    const pkg = getArtifact('contracts', 'gtai-fax-jam', 'Package')!;
    expect(pkg.status).toBe('pending');
    expect(pkg.reason).toMatch(/clerk-7/);
    expect(listArtifacts('contracts', 'gtai-fax-jam')).toHaveLength(5);
  });

  it('a re-sync after the art lands moves the verdict; a single quest can be targeted', async () => {
    writeQuest(ROOT, 'fax-jam', { art: false });
    inject.verdict = verdict('fax-jam');
    await sync({ questId: 'fax-jam' });
    writeQuest(ROOT, 'fax-jam');
    await sync({ questId: 'fax-jam' });
    expect(getArtifact('contracts', 'gtai-fax-jam', 'Package')!.status).toBe('pass');
  });

  it('refuses a bad or unknown questId, a non-GTAI game, and a cross-origin caller', async () => {
    expect((await sync({ questId: '../x' })).status).toBe(400);
    expect((await sync({ questId: 'nope' })).status).toBe(404);
    expect((await sync(undefined, 'pof')).status).toBe(404);
    expect((await sync(undefined, 'gtai', { origin: 'http://evil.example' })).status).toBe(403);
  });

  it('reports a mirror entity whose folder is gone as an orphan, without deleting it', async () => {
    writeQuest(ROOT, 'fax-jam');
    await sync();
    fs.rmSync(path.join(ROOT, 'games/gtai/quests/fax-jam'), { recursive: true });
    const { data } = await (await sync()).json();
    expect(data.orphans).toEqual(['gtai-fax-jam']);
    expect(getEntity('contracts', 'gtai-fax-jam')).not.toBeNull();
  });
});
