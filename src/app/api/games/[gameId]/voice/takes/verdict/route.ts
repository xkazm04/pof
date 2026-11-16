/**
 * `POST /api/games/[gameId]/voice/takes/verdict` `{ takeId, verdict: 'approved'|'rejected', note }` — HUMAN GATED.
 * Refused (403) unless the request is a browser fetch from the Voice room carrying its page token
 * (`gate.ts`). The headless CLI and agent tools never hold one; there is no other path to a verdict.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { gateRefusal } from '@/lib/voice/gate';
import { getLine, getTake, setVerdict } from '@/lib/voice/voice-db';
import { approvalRefusal } from '@/lib/voice/approval';
import { staleReason, syncQueue, voiceCtx } from '@/lib/voice/lineQueue';
import { takeView } from '@/lib/voice/room';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const verdict = b?.verdict;
    if (!b || typeof b.takeId !== 'string' || (verdict !== 'approved' && verdict !== 'rejected')) {
      return apiError('takeId and verdict (approved | rejected) are required', 400);
    }
    const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const take = getTake(db, b.takeId);
    if (!take || take.gameId !== gameId) return apiError(`no take ${b.takeId}`, 404);
    const line = getLine(db, gameId, take.questId, take.lineId);
    if (verdict === 'approved') {
      const why = approvalRefusal(take, line, voiceCtx(db, gameId));
      if (why) return apiError(why, 409);
    }
    const t = setVerdict(db, take.id, verdict, note);
    const vctx = voiceCtx(db, gameId);
    return apiSuccess({ take: t && line ? takeView(t, staleReason(t, line, vctx)) : null });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice verdict POST failed', 500);
  }
}
