/**
 * `GET /api/games/[gameId]/lanes` — the lanes control room: every runner root of the game (`GameDef.runners`,
 * env overrides in `runnersConfig.ts`) with each lane's id, model, state, iterations, cost, last commit,
 * last journal line, REPORT.md excerpt and frames (`LanesBoard`, `src/lib/games/runners/runnerTypes.ts`).
 * Read-only: nothing is written in any root. An unknown game is a 404; a game without runners is an honest
 * `configured: false` payload, not an error.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { readLanesBoard } from '@/lib/games/runners/readRunners';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    return apiSuccess(readLanesBoard(gameId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'lanes GET failed', 500);
  }
}
