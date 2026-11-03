import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Own throwaway DB + voice dir + fixture quest root: never the real ~/.pof/pof.db.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/voice-gate-${process.pid}/pof.db`;
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-gate-${process.pid}/voice`;
});
import { NextRequest } from 'next/server';
import { GET as roomGET } from '@/app/api/games/[gameId]/voice/route';
import { GET as gateGET } from '@/app/api/games/[gameId]/voice/gate/route';
import { POST as takesPOST } from '@/app/api/games/[gameId]/voice/takes/route';
import { POST as verdictPOST } from '@/app/api/games/[gameId]/voice/takes/verdict/route';
import { POST as voicesPOST } from '@/app/api/games/[gameId]/voice/voices/route';
import { POST as castPOST } from '@/app/api/games/[gameId]/voice/voices/cast/route';
import { GATE_HEADER, mintGateToken } from '@/lib/voice/gate';
import { makeFixtureRoot } from '@/__tests__/lib/voice/voiceFixture';

const ctx = { params: Promise.resolve({ gameId: 'gtai' }) };
const BROWSER = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };
const prevRoot = process.env.POF_GAMES_ROOT;

function req(url: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost/api/games/gtai/voice${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const json = async (r: Response) => (await r.json()) as { success: boolean; data?: Record<string, unknown>; error?: string };

let takeId = '';
let voiceId = '';

beforeAll(async () => {
  process.env.POF_GAMES_ROOT = makeFixtureRoot();
  process.env.ELEVENLABS_API_KEY = 'sk-test';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const v = await json(await voicesPOST(req('/voices', { action: 'stock', characterId: 'dock-guard', providerVoiceId: 'stock-g', name: 'Chris' }), ctx));
  voiceId = String((v.data?.voices as Array<{ id: string }>)[0].id);
  const t = await json(await takesPOST(req('/takes', { questId: 'zulu', lineId: 'z1', n: 1, direction: 'shouting' }), ctx));
  expect(t.success).toBe(true);
  takeId = String((t.data?.takes as Array<{ id: string }>)[0].id);
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  if (prevRoot === undefined) delete process.env.POF_GAMES_ROOT; else process.env.POF_GAMES_ROOT = prevRoot;
  delete process.env.ELEVENLABS_API_KEY;
});

describe('voice room human gate', () => {
  it('refuses a CLI-style verdict (Node fetch: no browser metadata, no token) with 403 and changes nothing', async () => {
    const r = await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved', note: 'cli' }), ctx);
    expect(r.status).toBe(403);
    expect((await json(r)).error).toMatch(/Human gate/);
    const room = await json(await roomGET(req(''), ctx));
    expect((room.data?.status as { proven: number }).proven).toBe(0);
  });

  it('refuses a CLI-style token request, and a forged token, and a missing token', async () => {
    expect((await gateGET(req('/gate'), ctx)).status).toBe(403);
    expect((await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved' }, { ...BROWSER, [GATE_HEADER]: 'voice-gate.9999999999999.forged' }), ctx)).status).toBe(403);
    expect((await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved' }, BROWSER), ctx)).status).toBe(403);
    expect((await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved' }, { [GATE_HEADER]: mintGateToken().token }), ctx)).status).toBe(403);
  });

  it('refuses an expired token', async () => {
    const old = mintGateToken(Date.now() - 60 * 60 * 1000).token;
    expect((await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved' }, { ...BROWSER, [GATE_HEADER]: old }), ctx)).status).toBe(403);
  });

  it('refuses casting from the CLI path', async () => {
    expect((await castPOST(req('/voices/cast', { voiceId }), ctx)).status).toBe(403);
  });

  it('accepts the room page: browser fetch + the token it was issued', async () => {
    const g = await json(await gateGET(req('/gate', undefined, BROWSER), ctx));
    const token = String(g.data?.token);
    const r = await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved', note: 'the panic lands' }, { ...BROWSER, [GATE_HEADER]: token }), ctx);
    expect(r.status).toBe(200);
    const room = await json(await roomGET(req(''), ctx));
    expect((room.data?.status as { proven: number }).proven).toBe(1);
    expect((await castPOST(req('/voices/cast', { voiceId }, { ...BROWSER, [GATE_HEADER]: token }), ctx)).status).toBe(200);
    // The read-only feed the CLI reads the owner's notes from: the room's verdict only (the refused CLI ones left no trace).
    const feed = await json(await roomGET(req('?view=verdicts&since=0'), ctx));
    expect((feed.data?.verdicts as Array<{ verdict: string; note: string; lineId: string }>).map((v) => [v.lineId, v.verdict, v.note]))
      .toEqual([['z1', 'approved', 'the panic lands']]);
  });

  it('re-casting another voice un-proves the line, and approving outside the cast voice is refused 409', async () => {
    const token = String((await json(await gateGET(req('/gate', undefined, BROWSER), ctx))).data?.token);
    const h = { ...BROWSER, [GATE_HEADER]: token };
    const other = await json(await voicesPOST(req('/voices', { action: 'stock', characterId: 'dock-guard', providerVoiceId: 'stock-h', name: 'Other' }), ctx));
    const otherId = String((other.data?.voices as Array<{ id: string }>)[0].id);
    expect((await castPOST(req('/voices/cast', { voiceId: otherId }, h), ctx)).status).toBe(200);
    const room = await json(await roomGET(req(''), ctx));
    expect((room.data?.status as { proven: number }).proven).toBe(0);
    const r = await verdictPOST(req('/takes/verdict', { takeId, verdict: 'approved', note: 'again' }, h), ctx);
    expect(r.status).toBe(409);
    expect((await json(r)).error).toMatch(/cast voice/);
  });

  it('voice.mjs has no verdict, approve or cast command', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('games/gtai/voice/voice.mjs', 'utf8');
    expect(src).not.toMatch(/takes\/verdict|voices\/cast/);
    expect(src).not.toMatch(/case ['"](approve|reject|cast|verdict)['"]/);
  });
});
