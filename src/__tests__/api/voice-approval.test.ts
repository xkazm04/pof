/** The verdict route's 409s: an approval is bound to the line's speaker (and, later, to cast-before-render). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/voice-approval-${process.pid}/pof.db`;
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-approval-${process.pid}/voice`;
});
import { NextRequest } from 'next/server';
import { GET as gateGET } from '@/app/api/games/[gameId]/voice/gate/route';
import { POST as takesPOST } from '@/app/api/games/[gameId]/voice/takes/route';
import { POST as verdictPOST } from '@/app/api/games/[gameId]/voice/takes/verdict/route';
import { POST as voicesPOST } from '@/app/api/games/[gameId]/voice/voices/route';
import { GATE_HEADER } from '@/lib/voice/gate';
import { makeFixtureRoot, writeQuest } from '@/__tests__/lib/voice/voiceFixture';

const ctx = { params: Promise.resolve({ gameId: 'gtai' }) };
const BROWSER = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };
const prevRoot = process.env.POF_GAMES_ROOT;
let root = '';

const req = (url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost/api/games/gtai/voice${url}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
type Env = { success: boolean; data?: Record<string, unknown>; error?: string };
const json = async (r: Response) => (await r.json()) as Env;
const gateHeaders = async () => ({ ...BROWSER, [GATE_HEADER]: String((await json(await gateGET(req('/gate', undefined, BROWSER), ctx))).data?.token) });

beforeAll(() => {
  root = makeFixtureRoot();
  process.env.POF_GAMES_ROOT = root;
  process.env.ELEVENLABS_API_KEY = 'sk-test';
});
afterAll(() => {
  if (prevRoot === undefined) delete process.env.POF_GAMES_ROOT; else process.env.POF_GAMES_ROOT = prevRoot;
  delete process.env.ELEVENLABS_API_KEY;
});

async function take(questId: string, lineId: string): Promise<Record<string, unknown>> {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const t = await json(await takesPOST(req('/takes', { questId, lineId, n: 1, direction: '' }), ctx));
  vi.restoreAllMocks();
  expect(t.success).toBe(true);
  return (t.data?.takes as Array<Record<string, unknown>>)[0];
}

describe('verdict route 409s', () => {
  it('refuses approving a take after its line was reassigned to another speaker', async () => {
    await voicesPOST(req('/voices', { action: 'stock', characterId: 'dock-guard', providerVoiceId: 'stock-g', name: 'Chris' }), ctx);
    const t = await take('zulu', 'z1');
    expect(t.reason).toBeNull();
    writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [
      { id: 'z1', speaker: 'nurse', text: 'He has got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call! Somebody page the supervisor, this is not in my contract.' },
      { id: 'z2', speaker: 'rivet', text: 'Okay. Okay okay okay.' },
    ]);
    const r = await verdictPOST(req('/takes/verdict', { takeId: t.id, verdict: 'approved' }, await gateHeaders()), ctx);
    expect(r.status).toBe(409);
    expect((await json(r)).error).toMatch(/belongs to dock-guard.*speaker nurse/);
  });
});
