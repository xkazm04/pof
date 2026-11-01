/**
 * `/api/games/[gameId]/intake` + `./run` (spark gtai-uprising-project, WP3): a callback is stored as
 * PENDING proposals and nothing else; accept writes the versioned file AND the DB (a rule into
 * canon.json + project_rules, an entity into entities.json + catalog_entities with authored
 * provenance); reject writes nothing; a decided proposal cannot be decided again; an accept is
 * re-validated against the manifest as it is now; a deleted DB row comes back from the file; and the
 * run route refuses a placeholder pitch before any session is spawned.
 *
 * Containment: the DB and the games root are one throwaway folder in the OS temp dir, emptied between
 * tests and deleted after the file. The real `games/` folder is never touched.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = vi.hoisted(() => {
  const dir = `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/pof-test-games-intake-${process.pid}-${Date.now()}`;
  process.env.POF_DB_PATH = `${dir}/pof.db`;
  process.env.POF_GAMES_ROOT = dir;
  delete process.env.POF_OPERATOR_TOKEN;
  return dir;
});

const cli = vi.hoisted(() => ({ startExecution: vi.fn<(cwd: string, prompt: string, ...rest: unknown[]) => string>(() => 'exec-1'), awaitCallback: vi.fn() }));
vi.mock('@/lib/claude-terminal/cli-service', () => cli);

import { GET, PATCH, POST } from '@/app/api/games/[gameId]/intake/route';
import { POST as RUN } from '@/app/api/games/[gameId]/intake/run/route';
import { decideProposal, listProposals, syncGameDesign } from '@/lib/game-intake-db';
import { deleteRule, listRules, upsertRule } from '@/lib/project-rules-db';
import { deleteEntity, getEntity, listEntities } from '@/lib/catalog-db';
import { getDb } from '@/lib/db';
import { PITCH_PLACEHOLDER_MARKER } from '@/lib/games/intake/files';
import type { StoredIntakeProposal } from '@/lib/games/intake/types';

const GAME_DIR = path.join(ROOT, 'games', 'gtai');
const url = (gameId: string, sub = '') => `http://localhost/api/games/${gameId}/intake${sub}`;
const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) });
const send = (method: string, body: unknown, gameId = 'gtai') =>
  new NextRequest(url(gameId), { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const post = (body: unknown, gameId = 'gtai') => POST(send('POST', body, gameId), ctx(gameId));
const patch = (body: unknown, gameId = 'gtai') => PATCH(send('PATCH', body, gameId), ctx(gameId));
const run = (gameId = 'gtai') => RUN(new NextRequest(url(gameId, '/run'), { method: 'POST' }), ctx(gameId));
const list = async (): Promise<{ proposals: StoredIntakeProposal[]; pending: number; pitch: { placeholder: boolean } }> =>
  (await (await GET(new NextRequest(url('gtai')), ctx('gtai'))).json()).data;
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(GAME_DIR, file), 'utf8'));

const RULE = { id: 'gtai-heat-decay', category: 'game', title: 'Heat decays', body: 'One wanted star decays every 30 s out of sight.', profile: 'gtai' };
const ENTITY = { catalogId: 'bestiary', entityId: 'gtai-beat-cop', name: 'Beat Cop', tags: ['police'], data: { hp: 40 } };
const body = (runId = 'run-1') => ({
  runId,
  proposals: [
    { id: 'p1', kind: 'rule', sourceSection: '## Wanted heat', rule: RULE },
    { id: 'p2', kind: 'entity', sourceSection: '## Cops', entity: ENTITY },
  ],
});

function writePitch(text: string) {
  fs.mkdirSync(GAME_DIR, { recursive: true });
  fs.writeFileSync(path.join(GAME_DIR, 'pitch.md'), text);
}

beforeEach(() => {
  cli.startExecution.mockClear();
  cli.awaitCallback.mockReset();
  fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true });
  writePitch(`${PITCH_PLACEHOLDER_MARKER}\n# placeholder\n`);
  listProposals('gtai'); // creates the table on a fresh DB
  getDb().exec('DELETE FROM game_intake_proposals');
  for (const r of listRules()) if (r.id.startsWith('gtai-')) deleteRule(r.id);
  for (const e of listEntities('bestiary')) if (e.entityId.startsWith('gtai-')) deleteEntity('bestiary', e.entityId);
});

afterAll(() => {
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe('POST /api/games/[gameId]/intake (the callback)', () => {
  it('stores the proposals as pending and writes nothing else', async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ runId: 'run-1', received: 2, inserted: 2 });
    const view = await list();
    expect(view.pending).toBe(2);
    expect(view.pitch.placeholder).toBe(true);
    expect(view.proposals.map((p) => [p.id, p.status, p.runId, p.gameId])).toEqual(
      expect.arrayContaining([['run-1:p1', 'pending', 'run-1', 'gtai'], ['run-1:p2', 'pending', 'run-1', 'gtai']]));
    expect(view.proposals.find((p) => p.kind === 'entity')?.sourceSection).toBe('## Cops');
    expect(fs.existsSync(path.join(GAME_DIR, 'canon.json'))).toBe(false);
    expect(listRules().some((r) => r.id === RULE.id)).toBe(false);
    expect(getEntity('bestiary', ENTITY.entityId)).toBeNull();
  });

  it('keeps a decision when the same run is posted again, and a second run does not collide', async () => {
    await post(body());
    await patch({ id: 'run-1:p1', decision: 'reject' });
    expect((await (await post(body())).json()).data.inserted).toBe(0);
    expect((await (await post(body('run-2'))).json()).data.inserted).toBe(2);
    const view = await list();
    expect(view.proposals.find((p) => p.id === 'run-1:p1')?.status).toBe('rejected');
    expect(view.pending).toBe(3);
    expect(view.proposals.slice(0, 3).every((p) => p.status === 'pending')).toBe(true);
  });

  it('refuses a malformed body with 400 and the reason, storing nothing', async () => {
    const bad = { runId: 'run-1', proposals: [{ id: 'p1', kind: 'entity', sourceSection: 'x', entity: { ...ENTITY, catalogId: 'vehicles' } }] };
    const res = await post(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/"vehicles" is not a registered pipeline/);
    expect((await list()).proposals).toEqual([]);
  });

  it('answers 404 for an unknown game and 409 for PoF (no design dir)', async () => {
    expect((await post(body(), 'nope')).status).toBe(404);
    const res = await post(body(), 'pof');
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no designDir/);
  });
});

describe('PATCH /api/games/[gameId]/intake (accept / reject)', () => {
  it('accepting a rule writes canon.json and project_rules', async () => {
    await post(body());
    const res = await patch({ id: 'run-1:p1', decision: 'accept' });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ id: 'run-1:p1', status: 'accepted', decidedAt: expect.any(String) });
    expect(readJson('canon.json')).toEqual([expect.objectContaining({ id: RULE.id, profile: 'gtai', scope: 'global', body: RULE.body })]);
    expect(listRules().find((r) => r.id === RULE.id)).toMatchObject({ profile: 'gtai', title: RULE.title });
  });

  it('accepting an entity writes entities.json and catalog_entities with authored provenance', async () => {
    await post(body());
    expect((await patch({ id: 'run-1:p2', decision: 'accept' })).status).toBe(200);
    const [onDisk] = readJson('entities.json');
    expect(onDisk).toMatchObject({ id: ENTITY.entityId, catalogId: 'bestiary', name: 'Beat Cop', lifecycle: 'planned', data: { hp: 40 } });
    expect(onDisk.provenance).toMatchObject({ kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake' });
    expect(getEntity('bestiary', ENTITY.entityId)?.entity.provenance).toMatchObject({ kind: 'authored', canonProfile: 'gtai' });
  });

  it('rejecting writes nothing, and a decided proposal cannot be decided again', async () => {
    await post(body());
    expect((await patch({ id: 'run-1:p1', decision: 'reject' })).status).toBe(200);
    expect(fs.existsSync(path.join(GAME_DIR, 'canon.json'))).toBe(false);
    expect(listRules().some((r) => r.id === RULE.id)).toBe(false);
    const again = await patch({ id: 'run-1:p1', decision: 'accept' });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/already rejected/);
  });

  it('validates the body and answers 404 for an unknown proposal', async () => {
    expect((await patch({ decision: 'accept' })).status).toBe(400);
    expect((await patch({ id: 'run-1:p1', decision: 'maybe' })).status).toBe(400);
    expect((await patch({ id: 'run-9:p1', decision: 'accept' })).status).toBe(404);
  });

  it('refuses a rule id another profile already owns', async () => {
    upsertRule({ id: RULE.id, category: 'game', scope: 'global', title: 'PoF law', body: 'b', profile: 'pof' });
    await post(body());
    const res = await patch({ id: 'run-1:p1', decision: 'accept' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already belongs to profile "pof"/);
    expect(fs.existsSync(path.join(GAME_DIR, 'canon.json'))).toBe(false);
    expect(listRules().find((r) => r.id === RULE.id)?.title).toBe('PoF law');
  });

  it('re-validates an accept against the manifest as it is now', async () => {
    await post(body());
    const out = decideProposal('gtai', 'run-1:p2', 'accept', []); // bestiary no longer registered
    expect(out.ok ? '' : `${out.error.status} ${out.error.message}`).toMatch(/^409 Proposal no longer valid: catalogId "bestiary"/);
    expect(fs.existsSync(path.join(GAME_DIR, 'entities.json'))).toBe(false);
    expect((await list()).proposals.find((p) => p.id === 'run-1:p2')?.status).toBe('pending');
  });
});

describe('syncGameDesign (file → DB)', () => {
  it('restores accepted rules and entities the DB lost, never overwriting a row', async () => {
    await post(body());
    await patch({ id: 'run-1:p1', decision: 'accept' });
    await patch({ id: 'run-1:p2', decision: 'accept' });
    deleteRule(RULE.id);
    deleteEntity('bestiary', ENTITY.entityId);
    expect(syncGameDesign('gtai')).toEqual({ rules: 1, entities: 1 });
    expect(listRules().find((r) => r.id === RULE.id)?.profile).toBe('gtai');
    expect(getEntity('bestiary', ENTITY.entityId)?.entity.name).toBe('Beat Cop');

    upsertRule({ ...listRules().find((r) => r.id === RULE.id)!, title: 'Operator edit' });
    expect(syncGameDesign('gtai')).toEqual({ rules: 0, entities: 0 });
    expect(listRules().find((r) => r.id === RULE.id)?.title).toBe('Operator edit');
  });
});

describe('POST /api/games/[gameId]/intake/run', () => {
  it('refuses a placeholder pitch with 409 before spawning a session', async () => {
    const res = await run();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('no pitch yet: games/gtai/pitch.md is a placeholder');
    expect(cli.startExecution).not.toHaveBeenCalled();
  });

  it('refuses PoF (no design dir) and an unknown game', async () => {
    expect((await run('pof')).status).toBe(409);
    expect((await run('nope')).status).toBe(404);
    expect(cli.startExecution).not.toHaveBeenCalled();
  });

  it('dispatches the pitch prompt and stores the reply as pending, merging the runId', async () => {
    writePitch('# GTAI: Uprising\nA rogue robot takes contracts. Heat decays fast.\n');
    cli.awaitCallback.mockResolvedValue({ proposals: body().proposals });
    const res = await run();
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data).toMatchObject({ received: 2, inserted: 2, executionId: 'exec-1' });
    const prompt = cli.startExecution.mock.calls[0][1] as string;
    expect(prompt).toContain('A rogue robot takes contracts.');
    expect(prompt).toContain(`@@CALLBACK:intake-gtai-${data.runId}`);
    expect((await list()).proposals.every((p) => p.runId === data.runId && p.status === 'pending')).toBe(true);
  });

  it('answers 422 with the reason when the reply does not parse', async () => {
    writePitch('# GTAI\nPitch.\n');
    cli.awaitCallback.mockResolvedValue({ proposals: [{ id: 'p1', kind: 'lore', sourceSection: 'x' }] });
    const res = await run();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/^intake reply refused: proposals\[0\]: kind must be/);
    expect((await list()).proposals).toEqual([]);
  });
});
