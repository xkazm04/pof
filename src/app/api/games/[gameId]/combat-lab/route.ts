/**
 * `GET /api/games/[gameId]/combat-lab?source=auto|main|<laneId>` — the combat lab's read: the weapons / enemies / powers
 * game tables and the arena's telemetry sessions (`src/lib/games/combatLab/`), from the game root and the lane worktrees
 * (`GameDef.combatLab`; the folders come from config and the lanes board, never from the query). Read-only. A table that
 * is not there is `missing` with where it is expected; a game with no combat lab is `configured: false`.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getGame, isGameId } from '@/lib/games/registry';
import { gameRootFor } from '@/lib/games/gameRoot';
import { readLanesBoard } from '@/lib/games/runners/readRunners';
import { readCombatLab } from '@/lib/games/combatLab/readCombatLab';
import { resolveSources } from '@/lib/games/combatLab/combatSources';
import type { CombatLabRead } from '@/lib/games/combatLab/combatTypes';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const cfg = getGame(gameId).combatLab;
    const ask = req.nextUrl.searchParams.get('source') ?? 'auto';
    if (!cfg) {
      const none: CombatLabRead = {
        gameId, readAt: new Date().toISOString(), configured: false, reason: `${gameId} declares no combat lab (GameDef.combatLab)`,
        source: ask, sources: [], tables: [], telemetry: { dirs: [], sessions: [], expected: '' },
      };
      return apiSuccess(none);
    }
    const set = resolveSources(cfg, gameRootFor(gameId), readLanesBoard(gameId), ask);
    if (!set) return apiError(`Unknown source "${ask}" (or its folder is not on disk)`, 404);
    return apiSuccess(readCombatLab(gameId, cfg, set.selected, set.pickable, ask));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'combat-lab GET failed', 500);
  }
}
