import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordScatterRun, getLatestScatterRun, listScatterRuns } from '@/lib/scatter-db';
import { parseRunSubmission } from '@/lib/level-design/run-ledger';

/**
 * GET /api/level-design/scatter-result
 *   (no params)                → the latest scatter, or null (unchanged shape)
 *   ?history=1[&limit=&docId=] → { runs: ScatterRun[] }, newest first
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('history')) {
      const rawDoc = searchParams.get('docId');
      const docId = rawDoc ? Number(rawDoc) : null;
      if (rawDoc && !Number.isInteger(docId)) return apiError('docId must be an integer', 400);
      return apiSuccess({
        runs: listScatterRuns({ limit: searchParams.get('limit'), docId }),
      });
    }
    return apiSuccess(getLatestScatterRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

/**
 * POST /api/level-design/scatter-result
 * Body: { instanceCount, seed, algorithm?, params?, docId?, mapPath?, success?, failureReason? }
 *
 * Same contract as the procgen ledger: a failed scatter is a stored row WITH its
 * reason, never a run that quietly never happened.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Body must be valid JSON', 400);
  }

  const parsed = parseRunSubmission(body, 'instanceCount');
  if (!parsed.ok) return apiError(parsed.error, 400);

  const { count, ...ledger } = parsed.data;
  try {
    return apiSuccess(recordScatterRun({ ...ledger, instanceCount: count }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
