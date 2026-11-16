/**
 * `POST /api/games/[gameId]/voice/takes` `{ questId, lineId, n, direction, voiceId?, settings? }` — generate
 * k takes (ElevenLabs text-to-speech). Not gated: it only adds `pending` takes for the owner to judge.
 * The new takes are then read back (local Whisper) in the BACKGROUND; the room's poll shows the result.
 * Off under test (`NODE_ENV=test`: no Python in unit tests) and with `POF_VOICE_READBACK=0`: the takes then read `off`.
 * Runs are single-flight (`readbackQueue.ts`) and a failure is recorded on the take (`failed` + reason).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { staleReason, syncQueue, voiceCtx } from '@/lib/voice/lineQueue';
import { takeView } from '@/lib/voice/room';
import { getLine, getTake, setReadbackStatus } from '@/lib/voice/voice-db';
import { generateTakes } from '@/lib/voice/takes';
import { readbackInBackground, reapOrphanedPending } from '@/lib/voice/readbackQueue';
import type { TakeSettings } from '@/lib/voice/types';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.questId !== 'string' || typeof b.lineId !== 'string') return apiError('questId and lineId are required', 400);
    if (!process.env.ELEVENLABS_API_KEY) return apiError('ELEVENLABS_API_KEY not configured; nothing generated', 503);
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const r = await generateTakes(db, {
      gameId, questId: b.questId, lineId: b.lineId, n: Number(b.n ?? 1),
      direction: typeof b.direction === 'string' ? b.direction : '',
      voiceId: typeof b.voiceId === 'string' ? b.voiceId : undefined,
      settings: (b.settings && typeof b.settings === 'object' ? b.settings : {}) as Partial<TakeSettings>,
    });
    if (!r.ok) return apiError(r.error, 422);
    const ids = r.data.map((t) => t.id);
    if (process.env.NODE_ENV !== 'test' && process.env.POF_VOICE_READBACK !== '0') {
      reapOrphanedPending(db, gameId);
      readbackInBackground(db, ids); // single-flight, records its own failure: the takes stay `pending` until it runs
    } else {
      for (const id of ids) setReadbackStatus(db, id, 'off'); // disabled by env: say so, never leave it looking pending
    }
    const takes = r.data.map((t) => getTake(db, t.id) ?? t);
    const line = getLine(db, gameId, b.questId, b.lineId);
    const vctx = voiceCtx(db, gameId);
    return apiSuccess({ takes: takes.map((t) => takeView(t, line ? staleReason(t, line, vctx) : 'text-edited')), chars: takes.reduce((n, t) => n + t.chars, 0) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice takes POST failed', 500);
  }
}
