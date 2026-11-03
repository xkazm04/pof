/**
 * `GET /api/games/[gameId]/voice/voices` — every voice (candidates + cast).
 * `POST` `{ action: 'design', characterId, n?, description? }` — design candidates from the voice bible;
 * `{ action: 'stock', characterId, providerVoiceId, name, note? }` — add a premade voice as a candidate.
 * Both only add CANDIDATES; casting is the gated `./cast`. Never a clone of a real person's voice.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { addStockCandidate, designForCharacter } from '@/lib/voice/design';
import { syncQueue } from '@/lib/voice/lineQueue';
import { listVoices } from '@/lib/voice/voice-db';

type Ctx = { params: Promise<{ gameId: string }> };
const ID = /^[a-z0-9-]+$/;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { gameId } = await ctx.params;
  if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
  return apiSuccess({ voices: listVoices(getVoiceDb(), gameId) });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.characterId !== 'string' || !ID.test(b.characterId)) return apiError('characterId is required', 400);
    const db = getVoiceDb();
    if (b.action === 'stock') {
      if (typeof b.providerVoiceId !== 'string' || typeof b.name !== 'string') return apiError('providerVoiceId and name are required', 400);
      const v = addStockCandidate(db, gameId, b.characterId, b.providerVoiceId, b.name, typeof b.note === 'string' ? b.note : null);
      return apiSuccess({ voices: [v], chars: 0 });
    }
    if (b.action !== 'design') return apiError("action must be 'design' or 'stock'", 400);
    if (!process.env.ELEVENLABS_API_KEY) return apiError('ELEVENLABS_API_KEY not configured; nothing designed', 503);
    syncQueue(db, gameId, questRoot());
    const r = await designForCharacter(db, questRoot(), gameId, b.characterId, {
      n: typeof b.n === 'number' ? b.n : undefined,
      description: typeof b.description === 'string' && b.description.trim() ? b.description : undefined,
    });
    return r.ok ? apiSuccess(r.data) : apiError(r.error, 422);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice voices POST failed', 500);
  }
}
