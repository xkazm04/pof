/**
 * F-11: the GTAI story map adapter (`campaignMapOf`) over `buildCampaignGraph`, and the
 * `GET /api/games/[gameId]/story` route over a temp games root. The empty ledger is the campaign
 * skeleton with "no contracts"; a package lands on the beat it realises, else in its act; the
 * open-canon beats stay locked; a folder whose quest.json does not load is listed, not hidden.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { campaignMapOf } from '@/lib/games/story/campaignMap';
import { ACT_IDS } from '@/lib/games/gtai-quest/types';
import type { QuestDesign, QuestPackage } from '@/lib/games/gtai-quest/types';
import { CLEAN, LEDGER_QUEST } from '@/__tests__/games/gtai-quest/fixtures';
import { GET } from '@/app/api/games/[gameId]/story/route';

const soulJob: QuestPackage = {
  ...LEDGER_QUEST,
  ...(CLEAN as QuestDesign),
  id: 'soul-job',
  title: 'Soul Job',
  claimsBeat: 'act1.soul-1',
  story: { reads: [], writes: [{ var: 'soul_gearbox_unlocked', value: true }] },
} as QuestPackage;

const beat = (m: ReturnType<typeof campaignMapOf>, id: string) => m.acts.flatMap((a) => a.beats).find((b) => b.id === id);

describe('campaignMapOf', () => {
  it('the empty ledger is the campaign skeleton: every act and beat, no contracts, zero errors', () => {
    const m = campaignMapOf([]);
    expect(m.contractCount).toBe(0);
    expect(m.acts.map((a) => a.act)).toEqual([...ACT_IDS]);
    expect(m.acts.every((a) => a.quests.length === 0)).toBe(true);
    expect(beat(m, 'act1.soul-1')?.state).toBe('open');
    expect(m.findings.errors).toBe(0);
    expect(m.graph.graphId).toBe('gtai-campaign');
  });

  it('locks the protected beats (the betrayal, soul 4) with a reason', () => {
    const m = campaignMapOf([]);
    expect(m.protectedBeats.map((b) => b.id).sort()).toEqual(['act3.betrayal', 'act4.soul-4']);
    expect(beat(m, 'act3.betrayal')).toMatchObject({ state: 'locked' });
    expect(beat(m, 'act4.soul-4')?.lockReason).toMatch(/owner-only/);
    expect(m.protectedVars.sort()).toEqual(['act_antagonist_order', 'betrayer', 'soul4_identity']);
  });

  it('places a quest that realises no beat in its act', () => {
    const m = campaignMapOf([LEDGER_QUEST]);
    const act1 = m.acts.find((a) => a.act === 'act1');
    expect(m.contractCount).toBe(1);
    expect(act1?.quests).toEqual([expect.objectContaining({ id: 'witnesses-are-crumbs', placedOn: null, status: 'built' })]);
    expect(m.graph.nodes.some((n) => n.id === 'quest.witnesses-are-crumbs')).toBe(true);
  });

  it('places a claiming quest on its beat and marks the beat realised, read back from the graph', () => {
    const m = campaignMapOf([soulJob]);
    expect(beat(m, 'act1.soul-1')).toMatchObject({ state: 'claimed', claimedBy: 'soul-job' });
    expect(m.acts.find((a) => a.act === 'act1')?.quests[0]).toMatchObject({ id: 'soul-job', placedOn: 'act1.soul-1' });
  });

  it('a claim on a locked beat is not placed and the beat stays locked', () => {
    const rogue = { ...soulJob, id: 'rogue', act: 'act3', claimsBeat: 'act3.betrayal', story: { reads: [], writes: [{ var: 'q_rogue', value: true }] } } as QuestPackage;
    const m = campaignMapOf([rogue]);
    expect(beat(m, 'act3.betrayal')?.state).toBe('locked');
    expect(m.acts.find((a) => a.act === 'act3')?.quests[0]).toMatchObject({ claimsBeat: 'act3.betrayal', placedOn: null });
  });
});

describe('GET /api/games/[gameId]/story', () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-story-map-'));
  const prev = process.env.POF_GAMES_ROOT;
  process.env.POF_GAMES_ROOT = ROOT;
  const quests = path.join(ROOT, 'games', 'gtai', 'quests');
  const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) });
  const get = async (gameId = 'gtai') => (await GET(new NextRequest(`http://localhost/api/games/${gameId}/story`), ctx(gameId))).json();

  beforeEach(() => fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true }));
  afterAll(() => {
    if (prev === undefined) delete process.env.POF_GAMES_ROOT; else process.env.POF_GAMES_ROOT = prev;
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it('with no quest folder returns the skeleton, a hash and no contracts', async () => {
    const body = await get();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ gameId: 'gtai', contractCount: 0, notLoaded: [], source: 'games/gtai/quests' });
    expect(body.data.hash).toMatch(/^[0-9a-f]{64}$|^sha256:/);
    expect(body.data.acts).toHaveLength(ACT_IDS.length);
  });

  it('reads quest packages from disk, skips _council, and lists a folder that does not load', async () => {
    fs.mkdirSync(path.join(quests, 'witnesses-are-crumbs'), { recursive: true });
    fs.writeFileSync(path.join(quests, 'witnesses-are-crumbs', 'quest.json'), JSON.stringify(LEDGER_QUEST));
    fs.mkdirSync(path.join(quests, '_council', 'run-1'), { recursive: true });
    fs.mkdirSync(path.join(quests, 'half-written'), { recursive: true });
    const body = await get();
    expect(body.data.contractCount).toBe(1);
    expect(body.data.notLoaded).toEqual(['half-written']);
    expect(body.data.acts.find((a: { act: string }) => a.act === 'act1').quests[0].id).toBe('witnesses-are-crumbs');
  });

  it('is GTAI-only: another game is a 404', async () => {
    const res = await GET(new NextRequest('http://localhost/api/games/pof/story'), ctx('pof'));
    expect(res.status).toBe(404);
  });
});
