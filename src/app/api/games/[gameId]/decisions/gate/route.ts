/**
 * `GET /api/games/[gameId]/decisions/gate` — mints the Decisions room's short-lived page token (the Voice room's
 * `@/lib/voice/gate`), ONLY for a same-origin browser fetch. The CLI (Node fetch, no `Sec-Fetch-*` metadata) gets 403.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { isBrowserFetch, mintGateToken } from '@/lib/voice/gate';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { gameId } = await ctx.params;
  if (!isGameId(gameId)) return apiError('Unknown game', 404);
  if (!isBrowserFetch(req.headers)) {
    return apiError('Human gate: the answer token is issued only to the PoF Decisions room page in a browser.', 403);
  }
  return apiSuccess(mintGateToken());
}
