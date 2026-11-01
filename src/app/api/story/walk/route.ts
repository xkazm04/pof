import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { findStoryGraphs } from '@/lib/story/story-db-conn';
import { DEFAULT_WALK_SAMPLES, MAX_WALK_SAMPLES, startWalkJob } from '@/lib/story/walk-jobs';

const bodySchema = z.strictObject({
  graphId: z.string().min(1),
  project: z.string().min(1).optional(),
  seed: z.number().int().optional(),
  samples: z.number().int().min(1).max(MAX_WALK_SAMPLES).optional(),
  cohorts: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        policy: z.enum(['uniform', 'weighted']),
        weights: z.record(z.string(), z.number().finite().min(0)).optional(),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
});

/**
 * POST /api/story/walk — start the bounded walker (§8 state pass) over one STORED graph, as a
 * background job. Body `{graphId, project?, seed?, samples?, cohorts?}`. Returns 202 `{jobId}` at
 * once; poll `GET /api/story/walk/:jobId`. The walk is pinned to the stored canonical hash, so its
 * evidence is `verified` against exactly that revision. Its findings are LEADS (state altitude),
 * never proven defects. Operator-guarded: it spends server CPU. Writes nothing to the DB.
 */
export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('request body must be JSON: {graphId, project?, seed?, samples?, cohorts?}', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '), 400);
  }
  const { graphId, project, seed = 1, samples = DEFAULT_WALK_SAMPLES, cohorts } = parsed.data;
  if (cohorts && new Set(cohorts.map((c) => c.id)).size !== cohorts.length) return apiError('cohort ids must be unique', 400);
  try {
    const rows = findStoryGraphs(graphId, project);
    if (rows.length === 0) return apiError(`story graph ${graphId} not found`, 404);
    if (rows.length > 1) {
      const projects = rows.map((r) => r.project).join(', ');
      return apiError(`graph id ${graphId} exists in several projects (${projects}); pass project`, 409);
    }
    const row = rows[0];
    const job = startWalkJob(row.graph, { seed, samples, cohorts, graphHash: row.hash });
    return apiSuccess(
      { jobId: job.id, state: job.state, progress: job.progress, graphId: row.graphId, project: row.project, hash: row.hash, seed, samples },
      202,
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to start the walk', 500);
  }
}
