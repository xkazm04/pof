/**
 * `POST /api/games/[gameId]/voice/casting/submit`
 * `{ roundId, verdicts: [{ voiceId, verdict: cast|iterate|decline, note? }], note? }` — HUMAN GATED (`gate.ts`):
 * the owner's whole round at once, from the Casting page. Every voice needs a verdict; at most one is `cast`.
 * A cast also saves the voice's design preview as a provider voice (so the design id cannot expire before the
 * first take). The casting log is regenerated after the submission.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { getVoice, setProviderVoiceId } from '@/lib/voice/voice-db';
import { getRound, submitRound, type SubmittedVerdict } from '@/lib/voice/castingDb';
import { writeCastingLog } from '@/lib/voice/castingView';
import { createDesignedVoice } from '@/lib/audio-gen/providers/elevenlabs-speech';
import { logger } from '@/lib/logger';

type Ctx = { params: Promise<{ gameId: string }> };
const VERDICTS = ['cast', 'iterate', 'decline'] as const;
const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function parse(raw: unknown): SubmittedVerdict[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SubmittedVerdict[] = [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    if (typeof o.voiceId !== 'string' || !VERDICTS.includes(o.verdict as (typeof VERDICTS)[number])) return null;
    out.push({ voiceId: o.voiceId, verdict: o.verdict as SubmittedVerdict['verdict'], note: clean(o.note, 2000) });
  }
  return out;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.roundId !== 'string') return apiError('roundId is required', 400);
    const verdicts = parse(b.verdicts);
    if (!verdicts) return apiError('verdicts must be [{ voiceId, verdict: cast|iterate|decline, note? }]', 400);
    const db = getVoiceDb();
    const round = getRound(db, b.roundId);
    if (!round || round.gameId !== gameId) return apiError(`no round ${b.roundId}`, 404);
    const r = submitRound(db, round.id, verdicts, clean(b.note, 4000));
    if (!r.ok) return apiError(r.error, r.status);
    let warning: string | null = null;
    const castId = verdicts.find((v) => v.verdict === 'cast')?.voiceId;
    const v = castId ? getVoice(db, castId) : null;
    const gen = v?.previews.find((p) => p.generatedVoiceId)?.generatedVoiceId;
    if (v && !v.providerVoiceId && gen) {
      try {
        setProviderVoiceId(db, v.id, await createDesignedVoice(`gtai ${v.characterId} ${v.name}`.slice(0, 60), v.designPrompt ?? v.characterId, gen));
      } catch (e) {
        warning = `cast recorded, but saving it as a provider voice failed (retried at the first take): ${e instanceof Error ? e.message : String(e)}`;
        logger.warn('casting: createDesignedVoice failed', { voiceId: v.id });
      }
    }
    return apiSuccess({ round: r.round, log: writeCastingLog(db, questRoot(), gameId, round.characterId), warning });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting submit POST failed', 500);
  }
}
