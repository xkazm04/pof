/**
 * `POST /api/games/[gameId]/voice/voices/profile` `{ voiceId, profile: { model, speed, stability, style } | null }` —
 * HUMAN GATED, like cast and verdict (`gate.ts`): the owner sets a cast voice's take profile (its render recipe)
 * from the Cast tab; nothing headless sets one (`voice.mjs` only prints it). Answers the voice and `unproven`,
 * how many lines the edit un-proved (their approved take was rendered with the old recipe).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { editTakeProfile } from '@/lib/voice/profileEdit';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.voiceId !== 'string' || !('profile' in b)) return apiError('voiceId and profile (an object, or null to clear) are required', 400);
    const r = editTakeProfile(getVoiceDb(), gameId, questRoot(), b.voiceId, b.profile);
    return r.ok ? apiSuccess({ voice: r.voice, unproven: r.unproven }) : apiError(r.error, r.status);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice profile POST failed', 500);
  }
}
