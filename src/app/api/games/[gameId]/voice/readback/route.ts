/**
 * `POST /api/games/[gameId]/voice/readback` `{ questId?, lineId? }` — read back (local Whisper) every take not
 * read back yet, for one line, one quest or the whole game, and wait for it. Not gated: it only measures.
 * New takes are read back in the background by the takes route; this is the backfill / retry path. It first
 * re-scores every stored transcript (cheap: the WER follows the current normalization and line text).
 * Single-flight with the background runs; each take ends `measured` or `failed` with its reason. Also the retry
 * path for takes that failed, were `off`, or were left `pending` by a restart.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, VOICE_GAMES } from '@/lib/voice/conn';
import { listTakes } from '@/lib/voice/voice-db';
import { rescoreReadbacks } from '@/lib/voice/readback';
import { readbackQueued, reapOrphanedPending } from '@/lib/voice/readbackQueue';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const questId = typeof b.questId === 'string' ? b.questId : undefined;
    const lineId = typeof b.lineId === 'string' ? b.lineId : undefined;
    const db = getVoiceDb();
    const rescored = rescoreReadbacks(db, gameId);
    reapOrphanedPending(db, gameId);
    const ids = listTakes(db, gameId, questId, lineId).filter((t) => t.readbackWer === null).map((t) => t.id);
    const r = await readbackQueued(db, ids);
    if (!r.ok) return apiError(r.error, 502);
    return apiSuccess({ requested: ids.length, rescored, ...r.data });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice readback POST failed', 500);
  }
}
