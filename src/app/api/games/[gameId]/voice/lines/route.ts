/** `GET /api/games/[gameId]/voice/lines?questId=&lineId=` — one line: text, speaker, bible, takes, history. */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { lineDetail } from '@/lib/voice/room';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const questId = req.nextUrl.searchParams.get('questId') ?? '';
    const lineId = req.nextUrl.searchParams.get('lineId') ?? '';
    const d = lineDetail(getVoiceDb(), gameId, questRoot(), questId, lineId);
    return d ? apiSuccess(d) : apiError(`no line ${questId}/${lineId} in the queue`, 404);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice line GET failed', 500);
  }
}
