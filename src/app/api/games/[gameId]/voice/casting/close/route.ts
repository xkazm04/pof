/**
 * `POST /api/games/[gameId]/voice/casting/close` `{ roundId, note? }` — HUMAN GATED (`gate.ts`): the owner closes a
 * round without a cast, with the comment the next round is written from. Refused while a candidate has no verdict.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { closeRound, getRound } from '@/lib/voice/castingDb';
import { writeCastingLog } from '@/lib/voice/castingView';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.roundId !== 'string') return apiError('roundId is required', 400);
    const db = getVoiceDb();
    const round = getRound(db, b.roundId);
    if (!round || round.gameId !== gameId) return apiError(`no round ${b.roundId}`, 404);
    const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 4000) : null;
    const r = closeRound(db, round.id, note);
    if (!r.ok) return apiError(r.error, r.status);
    return apiSuccess({ round: r.round, log: writeCastingLog(db, questRoot(), gameId, round.characterId) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting close POST failed', 500);
  }
}
