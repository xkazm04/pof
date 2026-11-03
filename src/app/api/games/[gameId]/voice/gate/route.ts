/**
 * `GET /api/games/[gameId]/voice/gate` — mints the Voice room's short-lived page token (`gate.ts`), ONLY for a
 * same-origin browser fetch. The CLI (Node fetch, no `Sec-Fetch-*` metadata) is refused 403.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { VOICE_GAMES } from '@/lib/voice/conn';
import { isBrowserFetch, mintGateToken } from '@/lib/voice/gate';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { gameId } = await ctx.params;
  if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
  if (!isBrowserFetch(req.headers)) {
    return apiError('Human gate: the verdict token is issued only to the PoF Voice room page in a browser.', 403);
  }
  return apiSuccess(mintGateToken());
}
