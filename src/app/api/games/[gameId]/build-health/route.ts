/**
 * `GET /api/games/[gameId]/build-health` — the game's build health from its own evidence files
 * (ticket F-10): one row per `pof.godot-evidence/1` kind with PoF's verdict, the root, the HEAD and
 * an aggregate (`BuildHealth`, `src/lib/games/godot/buildHealthTypes.ts`). Read-only.
 *
 * `?lane=<id>` reads that lane worktree's `build/evidence/` (a lane of the lanes control room, resolved through
 * the configured runner roots, never an arbitrary path): `BuildHealth.lane` names it. An unknown lane is a 404.
 *
 * An unknown game id is a 404. A game that is not on Godot, or whose root is not on disk, is an
 * honest `binding: 'unbound'` payload with the reason, not an error.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { buildHealthFor } from '@/lib/games/godot/buildHealth';
import { laneCwd, readLanesBoard } from '@/lib/games/runners/readRunners';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const laneId = req.nextUrl.searchParams.get('lane');
    if (!laneId) return apiSuccess(buildHealthFor(gameId));
    const cwd = laneCwd(readLanesBoard(gameId), laneId);
    if (!cwd) return apiError(`Unknown lane "${laneId}" (or its worktree is not on disk)`, 404);
    return apiSuccess(buildHealthFor(gameId, { lane: { id: laneId, cwd } }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'build-health GET failed', 500);
  }
}
