/**
 * `POST /api/games/[gameId]/voice/casting/verdict` `{ voiceId, verdict: cast|iterate|decline|pending, note? }` —
 * HUMAN GATED (`gate.ts`): a casting verdict is the owner's click in the Casting page, never a CLI or agent call.
 * `cast` casts the voice, closes its round, and saves the design preview as a provider voice (so the design id
 * cannot expire before the first take). The casting log is regenerated after every verdict.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { getVoice, setProviderVoiceId } from '@/lib/voice/voice-db';
import { setCastVerdict, type CastVerdict } from '@/lib/voice/castingDb';
import { writeCastingLog } from '@/lib/voice/castingView';
import { createDesignedVoice } from '@/lib/audio-gen/providers/elevenlabs-speech';
import { logger } from '@/lib/logger';

type Ctx = { params: Promise<{ gameId: string }> };
const VERDICTS: readonly CastVerdict[] = ['cast', 'iterate', 'decline', 'pending'];

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.voiceId !== 'string') return apiError('voiceId is required', 400);
    const verdict = b.verdict as CastVerdict;
    if (!VERDICTS.includes(verdict)) return apiError(`verdict must be one of ${VERDICTS.join(', ')}`, 400);
    const db = getVoiceDb();
    const v = getVoice(db, b.voiceId);
    if (!v || v.gameId !== gameId) return apiError(`no voice ${b.voiceId}`, 404);
    const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
    const r = setCastVerdict(db, v.id, verdict, note);
    if (!r.ok) return apiError(r.error, r.status);
    let warning: string | null = null;
    const gen = v.previews.find((p) => p.generatedVoiceId)?.generatedVoiceId;
    if (verdict === 'cast' && !v.providerVoiceId && gen) {
      try {
        setProviderVoiceId(db, v.id, await createDesignedVoice(`gtai ${v.characterId} ${v.name}`.slice(0, 60), v.designPrompt ?? v.characterId, gen));
      } catch (e) {
        warning = `cast recorded, but saving it as a provider voice failed (retried at the first take): ${e instanceof Error ? e.message : String(e)}`;
        logger.warn('casting: createDesignedVoice failed', { voiceId: v.id });
      }
    }
    const log = writeCastingLog(db, questRoot(), gameId, v.characterId);
    return apiSuccess({ round: r.round, voice: getVoice(db, v.id), log, warning });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting verdict POST failed', 500);
  }
}
