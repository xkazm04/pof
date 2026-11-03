import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as boardGET, POST as answerPOST } from '@/app/api/games/[gameId]/decisions/route';
import { GET as gateGET } from '@/app/api/games/[gameId]/decisions/gate/route';
import { GET as mediaGET } from '@/app/api/games/[gameId]/decisions/media/route';
import { GATE_HEADER, mintGateToken } from '@/lib/voice/gate';
import { makeDecisionsFixture, type Fixture } from '@/__tests__/games/decisions/decisionsFixture';

const ctx = { params: Promise.resolve({ gameId: 'gtai' }) };
const BROWSER = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };
const prev = process.env.POF_GAME_DECISIONS_GTAI;
let fx: Fixture;

const req = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/games/gtai/decisions${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (r: Response) => (await r.json()) as { success: boolean; data?: any; error?: string };
const answersFile = () => path.join(fx.root, 'answers.json');

beforeEach(() => { fx = makeDecisionsFixture(); process.env.POF_GAME_DECISIONS_GTAI = fx.root; });
afterEach(() => {
  fx.cleanup();
  if (prev === undefined) delete process.env.POF_GAME_DECISIONS_GTAI; else process.env.POF_GAME_DECISIONS_GTAI = prev;
});

describe('decisions human gate', () => {
  it('GET returns the board in the envelope', async () => {
    const b = await json(await boardGET(req(''), ctx));
    expect(b.success).toBe(true);
    expect(b.data.open.map((d: { id: string }) => d.id)).toEqual(['gunplay-2', 'arena-1']);
    expect(b.data.configured).toBe(true);
  });

  it('refuses a CLI-style answer (no browser metadata, no token) with 403 and writes nothing', async () => {
    const before = fs.readFileSync(answersFile(), 'utf8');
    const r = await answerPOST(req('', { id: 'arena-1', choice: 'pistol' }), ctx);
    expect(r.status).toBe(403);
    expect((await json(r)).error).toMatch(/Human gate/);
    expect(fs.readFileSync(answersFile(), 'utf8')).toBe(before);
  });

  it('refuses browser metadata without a token, a forged token, and an expired token', async () => {
    const body = { id: 'arena-1', choice: 'pistol' };
    expect((await answerPOST(req('', body, BROWSER), ctx)).status).toBe(403);
    expect((await answerPOST(req('', body, { ...BROWSER, [GATE_HEADER]: 'voice-gate.9999999999999.forged' }), ctx)).status).toBe(403);
    const expired = mintGateToken(Date.now() - 11 * 60 * 1000).token;
    expect((await answerPOST(req('', body, { ...BROWSER, [GATE_HEADER]: expired }), ctx)).status).toBe(403);
    expect(JSON.parse(fs.readFileSync(answersFile(), 'utf8')).answers).toHaveLength(1);
  });

  it('refuses the token mint to a CLI fetch and gives a browser fetch a token that then works', async () => {
    expect((await gateGET(req('/gate'), ctx)).status).toBe(403);
    const m = await json(await gateGET(req('/gate', undefined, BROWSER), ctx));
    expect(m.success).toBe(true);
    const r = await answerPOST(req('', { id: 'arena-1', choice: 'shotgun', note: 'yes' }, { ...BROWSER, [GATE_HEADER]: m.data.token }), ctx);
    expect(r.status).toBe(200);
    expect((await json(r)).data.answer).toMatchObject({ id: 'arena-1', choice: 'shotgun', note: 'yes' });
    expect(JSON.parse(fs.readFileSync(answersFile(), 'utf8')).answers.map((a: { id: string }) => a.id)).toEqual(['old-0', 'arena-1']);
  });

  it('validates the body after the gate', async () => {
    const h = { ...BROWSER, [GATE_HEADER]: mintGateToken().token };
    expect((await answerPOST(req('', { id: 'arena-1' }, h), ctx)).status).toBe(400);
    expect((await answerPOST(req('', { id: 'arena-1', choice: 'bazooka' }, h), ctx)).status).toBe(400);
    expect((await answerPOST(req('', { id: 'ghost', choice: 'x' }, h), ctx)).status).toBe(404);
  });

  it('an unknown game is 404 and a game with no decision folder says so', async () => {
    const bad = { params: Promise.resolve({ gameId: 'nope' }) };
    expect((await boardGET(req(''), bad)).status).toBe(404);
    const pof = { params: Promise.resolve({ gameId: 'pof' }) };
    const r = await json(await boardGET(req(''), pof));
    expect(r.data).toMatchObject({ configured: false });
  });
});

describe('decisions media door', () => {
  const q = (s: string, headers: Record<string, string> = {}) => mediaGET(req(`/media?${s}`, undefined, headers), ctx);
  it('serves a listed image, with byte ranges for a clip', async () => {
    const img = await q('ask=arena-1&opt=pistol&n=0');
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    const clip = await q('ask=arena-1&opt=pistol&n=1', { range: 'bytes=0-9' });
    expect(clip.status).toBe(206);
    expect(clip.headers.get('content-type')).toBe('video/mp4');
    expect(clip.headers.get('content-range')).toBe('bytes 0-9/64');
  });
  it('never serves an unlisted path, a listed non-media file, or a traversal', async () => {
    expect((await q('ask=arena-1&opt=shotgun&n=1')).status).toBe(404);
    expect((await q('ask=arena-1&opt=pistol&n=7')).status).toBe(404);
    expect((await q('ask=..%2Fasks%2Farena-1&opt=pistol&n=0')).status).toBe(400);
    expect((await q('ask=arena-1&opt=pistol&n=abc')).status).toBe(400);
  });
});
