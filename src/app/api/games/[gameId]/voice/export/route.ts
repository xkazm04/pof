/**
 * `POST /api/games/[gameId]/voice/export` `{ questId }` — writes the quest's PROVEN lines into the game root
 * (`gameRootFor`, so `POF_GAME_ROOT_GTAI` points it at a fixture in tests). Unproven lines are skipped and
 * listed. Run only on the owner's Export press or `voice.mjs export`.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { gameRootFor, noGameRootReason } from '@/lib/games/gameRoot';
import type { GameId } from '@/lib/games/types';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { exportQuest } from '@/lib/voice/exportQuest';
import { syncQueue } from '@/lib/voice/lineQueue';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.questId !== 'string') return apiError('questId is required', 400);
    const root = gameRootFor(gameId as GameId);
    if (!root) return apiError(noGameRootReason(gameId as GameId), 409);
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const r = await exportQuest(db, gameId, b.questId, root);
    return r.ok ? apiSuccess(r.data) : apiError(r.error, 422);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice export POST failed', 500);
  }
}
