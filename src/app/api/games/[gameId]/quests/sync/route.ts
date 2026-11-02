/**
 * `POST /api/games/[gameId]/quests/sync` — mirror GTAI quest folders into the `contracts` catalog
 * (spark gta-quest-loop, WP2). Called by the `/gta --quest` CLI after it writes or changes a package.
 *
 * Body (optional): `{ questId?: string }` — one quest, else every folder. For each quest it upserts the
 * entity `gtai-<id>` (profile `gtai`, `data.snapshot` = the folder read) and submits each step's slice
 * through the one write door, which re-grades it server-side. Operator-guarded like the intake callback.
 * It never writes under `games/`.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { syncContracts } from '@/lib/catalog/pipelines/contracts/contractsSync';
import { listQuestIds } from '@/lib/catalog/pipelines/contracts/contractsRead';
import { resolveGamesRoot } from '@/lib/games/intake/files';

type Ctx = { params: Promise<{ gameId: string }> };
const QUEST_ID = /^[a-z0-9][a-z0-9-]*$/;

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const { gameId } = await ctx.params;
    if (gameId !== 'gtai') return apiError('No quest ledger: the quest loop is GTAI-only (games/gtai/quests)', 404);
    const text = await req.text();
    let body: { questId?: unknown } = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text) as { questId?: unknown };
      } catch {
        return apiError('body must be JSON: { questId?: string }', 400);
      }
    }
    const root = resolveGamesRoot();
    let only: string | undefined;
    if (body.questId !== undefined) {
      if (typeof body.questId !== 'string' || !QUEST_ID.test(body.questId)) return apiError('questId must be a kebab-case folder name', 400);
      if (!listQuestIds(root).includes(body.questId)) return apiError(`no quest folder games/gtai/quests/${body.questId}`, 404);
      only = body.questId;
    }
    return apiSuccess(syncContracts(root, only));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'quests sync failed', 500);
  }
}
