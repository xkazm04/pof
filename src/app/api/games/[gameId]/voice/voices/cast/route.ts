/**
 * `POST /api/games/[gameId]/voice/voices/cast` `{ voiceId }` — HUMAN GATED, like a verdict (`gate.ts`):
 * casting a character's voice is the owner's click in the Voice room, never a CLI or agent call.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { castVoice, getVoice } from '@/lib/voice/voice-db';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.voiceId !== 'string') return apiError('voiceId is required', 400);
    const db = getVoiceDb();
    const v = getVoice(db, b.voiceId);
    if (!v || v.gameId !== gameId) return apiError(`no voice ${b.voiceId}`, 404);
    return apiSuccess({ voice: castVoice(db, v.id) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice cast POST failed', 500);
  }
}
