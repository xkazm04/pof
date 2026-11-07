/**
 * `GET /api/games/[gameId]/voice/casting?character=<id>` — the Casting page: the character, its art, every round.
 * `GET` without `character` — the castable characters (bibles + art map). Both carry `demand` (`castingDemand`):
 * which speakers have lines and no cast voice, and which cast voices speak nothing.
 * `POST` `{ characterId, brief, candidates: [{ label, description, seed?, parentVoiceId? }], sampleText?, model? }` —
 * design one round (1-5 candidates). Only ADDS candidates; verdicts, closing and casting are the gated
 * `./verdict` and `./close`. Never a clone of a real person's voice (description only, no reference audio).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { syncQueue } from '@/lib/voice/lineQueue';
import { designRound, type CandidateSpec } from '@/lib/voice/castingRound';
import { castingDemand } from '@/lib/voice/castingDemand';
import { castingCharacters, castingView, writeCastingLog } from '@/lib/voice/castingView';

type Ctx = { params: Promise<{ gameId: string }> };
const ID = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const character = req.nextUrl.searchParams.get('character');
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const demand = castingDemand(db, gameId);
    if (!character) return apiSuccess({ characters: castingCharacters(db, questRoot(), gameId), demand });
    if (!ID.test(character)) return apiError('character must be a lowercase id', 400);
    return apiSuccess({ ...castingView(db, questRoot(), gameId, character), demand });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting GET failed', 500);
  }
}

function specs(raw: unknown): CandidateSpec[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CandidateSpec[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') return null;
    const o = c as Record<string, unknown>;
    if (typeof o.label !== 'string' || typeof o.description !== 'string') return null;
    out.push({
      label: o.label, description: o.description,
      seed: typeof o.seed === 'number' ? o.seed : undefined,
      parentVoiceId: typeof o.parentVoiceId === 'string' ? o.parentVoiceId : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.characterId !== 'string' || !ID.test(b.characterId)) return apiError('characterId is required', 400);
    const candidates = specs(b.candidates);
    if (!candidates) return apiError('candidates must be [{ label, description, seed?, parentVoiceId? }]', 400);
    if (!process.env.ELEVENLABS_API_KEY) return apiError('ELEVENLABS_API_KEY not configured; nothing designed', 503);
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const r = await designRound(db, {
      gameId, characterId: b.characterId, brief: typeof b.brief === 'string' ? b.brief : '', candidates,
      sampleText: typeof b.sampleText === 'string' ? b.sampleText : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
      append: b.append === true,
    });
    if (!r.ok) return apiError(r.error, 422);
    const log = writeCastingLog(db, questRoot(), gameId, b.characterId);
    return apiSuccess({ ...r.data, log });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting POST failed', 500);
  }
}
