/**
 * `/api/games/[gameId]/intake` — the pitch-intake review queue (spark gtai-uprising-project, WP3).
 *
 * - POST  the CLI callback (`IntakeCallbackBody`): validated against the game's manifest and stored
 *         as PENDING proposals. Operator-guarded (it is the `@@CALLBACK` target).
 * - GET   the game's proposals, pending first, plus `pitch: { placeholder }` and the pending count.
 * - PATCH `IntakeDecisionBody`: accept writes the versioned file AND the DB; reject records only.
 *
 * The lab's "Run intake" dispatches through `./run` (server-side, like the one-shot routes).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { isGameId } from '@/lib/games/registry';
import { readPitch } from '@/lib/games/intake/files';
import { decideProposal, ingestIntakeCallback, listProposals } from '@/lib/game-intake-db';
// Populates the pipeline registry through THIS route's import graph — the manifest check reads it.
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

type Ctx = { params: Promise<{ gameId: string }> };

const registered = () => allCatalogPipelines().map((p) => p.catalogId);

async function gameOf(ctx: Ctx) {
  const { gameId } = await ctx.params;
  return isGameId(gameId) ? gameId : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const gameId = await gameOf(ctx);
    if (!gameId) return apiError('Unknown game', 404);
    const proposals = listProposals(gameId);
    return apiSuccess({
      proposals,
      pending: proposals.filter((p) => p.status === 'pending').length,
      pitch: { placeholder: readPitch(gameId).placeholder },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'intake GET failed', 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const gameId = await gameOf(ctx);
    if (!gameId) return apiError('Unknown game', 404);
    const body = await req.json().catch(() => null);
    const out = ingestIntakeCallback(gameId, body, registered());
    return out.ok ? apiSuccess(out.data) : apiError(out.error.message, out.error.status);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'intake POST failed', 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const gameId = await gameOf(ctx);
    if (!gameId) return apiError('Unknown game', 404);
    const body = (await req.json().catch(() => null)) as { id?: unknown; decision?: unknown } | null;
    if (typeof body?.id !== 'string' || !body.id) return apiError('id is required', 400);
    if (body.decision !== 'accept' && body.decision !== 'reject') return apiError('decision must be "accept" or "reject"', 400);
    const out = decideProposal(gameId, body.id, body.decision, registered());
    return out.ok ? apiSuccess(out.data) : apiError(out.error.message, out.error.status);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'intake PATCH failed', 500);
  }
}
