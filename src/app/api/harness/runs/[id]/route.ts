/**
 * GET    /api/harness/runs/:id  → full plan/progress/guide/cost snapshot
 * DELETE /api/harness/runs/:id  → drop the row (operator cleanup)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getRun, deleteRun } from '@/lib/harness-runs-db';

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return apiError(`Run not found: ${id}`, 404);
  return apiSuccess(run);
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const ok = deleteRun(id);
  if (!ok) return apiError(`Run not found: ${id}`, 404);
  return apiSuccess({ deleted: id });
}
