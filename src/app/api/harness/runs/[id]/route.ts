/**
 * GET    /api/harness/runs/:id  → full plan/progress/guide/cost snapshot
 * DELETE /api/harness/runs/:id  → drop the row (operator cleanup); 409 while that run is live
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getRun, deleteRun } from '@/lib/harness-runs-db';

interface RouteCtx { params: Promise<{ id: string }> }

// The live orchestrator is held on globalThis by the harness route module (../route.ts).
interface LiveHarness {
  harnessStatus?: string;
  harnessOrchestrator?: { getRunId?: () => string | null };
}

/** True when `id` is the run this process is executing or holds paused in memory. */
function isLiveRun(id: string): boolean {
  const g = globalThis as unknown as LiveHarness;
  if (g.harnessStatus !== 'running' && g.harnessStatus !== 'paused') return false;
  return g.harnessOrchestrator?.getRunId?.() === id;
}

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return apiError(`Run not found: ${id}`, 404);
  return apiSuccess(run);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const denied = requireOperator(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  // The orchestrator keeps writing progress to this row; dropping it would lose the run from history.
  if (isLiveRun(id)) return apiError(`Run ${id} is live — pause or finish it before deleting its record`, 409);
  const ok = deleteRun(id);
  if (!ok) return apiError(`Run not found: ${id}`, 404);
  return apiSuccess({ deleted: id });
}
