/** The take-profile route is behind the same human gate as cast and verdict. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/voice-profile-gate-${process.pid}/pof.db`;
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-profile-gate-${process.pid}/voice`;
});
import { NextRequest } from 'next/server';
import { GET as gateGET } from '@/app/api/games/[gameId]/voice/gate/route';
import { GET as voicesGET, POST as voicesPOST } from '@/app/api/games/[gameId]/voice/voices/route';
import { POST as castPOST } from '@/app/api/games/[gameId]/voice/voices/cast/route';
import { POST as profilePOST } from '@/app/api/games/[gameId]/voice/voices/profile/route';
import { GATE_HEADER } from '@/lib/voice/gate';
import { makeFixtureRoot } from '@/__tests__/lib/voice/voiceFixture';

const ctx = { params: Promise.resolve({ gameId: 'gtai' }) };
const BROWSER = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };
const prevRoot = process.env.POF_GAMES_ROOT;
const req = (url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost/api/games/gtai/voice${url}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
type Env = { success: boolean; data?: Record<string, unknown>; error?: string };
const json = async (r: Response) => (await r.json()) as Env;
const PROFILE = { model: 'eleven_v3', speed: 1.2, stability: 0.5, style: 0 };
let voiceId = '';

beforeAll(async () => {
  process.env.POF_GAMES_ROOT = makeFixtureRoot();
  const v = await json(await voicesPOST(req('/voices', { action: 'stock', characterId: 'rivet', providerVoiceId: 'stock-r', name: 'Liam' }), ctx));
  voiceId = String((v.data?.voices as Array<{ id: string }>)[0].id);
});
afterAll(() => { if (prevRoot === undefined) delete process.env.POF_GAMES_ROOT; else process.env.POF_GAMES_ROOT = prevRoot; });

describe('take profile gate', () => {
  it('refuses a non-browser call, a forged token and a missing token, and changes nothing', async () => {
    expect((await profilePOST(req('/voices/profile', { voiceId, profile: PROFILE }), ctx)).status).toBe(403);
    expect((await profilePOST(req('/voices/profile', { voiceId, profile: PROFILE }, { ...BROWSER, [GATE_HEADER]: 'voice-gate.9999999999999.forged' }), ctx)).status).toBe(403);
    expect((await profilePOST(req('/voices/profile', { voiceId, profile: PROFILE }, BROWSER), ctx)).status).toBe(403);
    const voices = (await json(await voicesGET(req('/voices'), ctx))).data?.voices as Array<{ takeProfile: unknown }>;
    expect(voices[0].takeProfile).toBeNull();
  });

  it('accepts the room page: 409 for a candidate, then sets it on the cast voice and clears it with null', async () => {
    const token = String((await json(await gateGET(req('/gate', undefined, BROWSER), ctx))).data?.token);
    const h = { ...BROWSER, [GATE_HEADER]: token };
    expect((await profilePOST(req('/voices/profile', { voiceId, profile: PROFILE }, h), ctx)).status).toBe(409);
    expect((await castPOST(req('/voices/cast', { voiceId }, h), ctx)).status).toBe(200);
    const ok = await json(await profilePOST(req('/voices/profile', { voiceId, profile: PROFILE }, h), ctx));
    expect(ok.success).toBe(true);
    expect((ok.data?.voice as { takeProfile: unknown }).takeProfile).toEqual(PROFILE);
    expect((await profilePOST(req('/voices/profile', { voiceId, profile: { ...PROFILE, speed: 5 } }, h), ctx)).status).toBe(400);
    expect((await json(await profilePOST(req('/voices/profile', { voiceId, profile: null }, h), ctx))).success).toBe(true);
  });

  it('voice.mjs only prints profiles: no profile route in the CLI', async () => {
    const src = (await import('node:fs')).readFileSync('games/gtai/voice/voice.mjs', 'utf8');
    expect(src).not.toMatch(/voices\/profile/);
  });
});
