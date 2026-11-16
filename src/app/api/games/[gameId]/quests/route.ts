/**
 * `GET /api/games/[gameId]/quests` — the GTAI quest ledger (spark gta-quest-loop, WP2).
 *
 * Every quest folder under `games/gtai/quests/` (not `_council`), derived from disk on THIS read: the
 * snapshot, the guard verdict (`assessQuest` over `loadQuestContext()`) and each `contracts` step's
 * acceptance, graded by the same checkers the registered pipeline uses. Read-only: it never writes the
 * catalog mirror — `./sync` does. A package that does not parse is listed with its parse error, not hidden.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { contractsLedger } from '@/lib/catalog/pipelines/contracts/contractsSync';

type Ctx = { params: Promise<{ gameId: string }> };

/** The quest loop exists for GTAI only; any other game id is not a quest ledger. */
async function questGameOf(ctx: Ctx): Promise<'gtai' | null> {
  const { gameId } = await ctx.params;
  return gameId === 'gtai' ? 'gtai' : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    if (!(await questGameOf(ctx))) return apiError('No quest ledger: the quest loop is GTAI-only (games/gtai/quests)', 404);
    const quests = contractsLedger();
    return apiSuccess({
      quests,
      count: quests.length,
      blocked: quests.filter((q) => q.blocked).length,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'quests GET failed', 500);
  }
}
