/**
 * `GET /api/games/[gameId]/voice` — the Voice room state: the line queue in chronological play order
 * (re-read from the quest packages on THIS request), per-quest proven counts, the next unproven lines and
 * the voices. `?view=status&n=N` returns only the status (what `voice.mjs status|next` reads).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { roomState } from '@/lib/voice/room';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}: the quest loop is GTAI-only`, 404);
    const n = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('n')) || 5));
    const state = roomState(getVoiceDb(), gameId, questRoot(), n);
    if (req.nextUrl.searchParams.get('view') === 'status') return apiSuccess(state.status);
    return apiSuccess(state);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice GET failed', 500);
  }
}
