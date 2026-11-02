/**
 * `GET /api/games/[gameId]/story` — the GTAI campaign map (ticket F-11): the `pof.storygraph/1` graph
 * `buildCampaignGraph` composes from the quest packages under `games/gtai/quests/*` /quest.json, its
 * canonical hash, and the per-act reading (`CampaignMap`, `src/lib/games/story/campaignMap.ts`).
 * Derived from disk on every read; writes nothing (the graph is not imported into `story_graphs`).
 *
 * GTAI-only, like the quest ledger: any other game id is a 404.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { resolveGamesRoot } from '@/lib/games/intake/files';
import { loadLedger } from '@/lib/games/gtai-quest/loadContext';
import { listQuestIds } from '@/lib/catalog/pipelines/contracts/contractsRead';
import { campaignMapOf } from '@/lib/games/story/campaignMap';
import { storyContentHash } from '@/lib/story/canonical';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (gameId !== 'gtai') return apiError('No campaign map: the story map reads the GTAI quest ledger (games/gtai/quests) only', 404);
    const root = resolveGamesRoot();
    const ledger = loadLedger(root);
    const loaded = new Set(ledger.map((q) => q.id));
    const map = campaignMapOf(ledger, listQuestIds(root).filter((id) => !loaded.has(id)));
    return apiSuccess({ ...map, hash: await storyContentHash(map.graph), source: 'games/gtai/quests' });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'story map GET failed', 500);
  }
}
