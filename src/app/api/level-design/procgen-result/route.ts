import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordProcgenRun, getLatestProcgenRun, listProcgenRuns } from '@/lib/procgen-db';
import { parseRunSubmission } from '@/lib/level-design/run-ledger';

/**
 * GET /api/level-design/procgen-result
 *   (no params)                → the latest run, or null (unchanged shape)
 *   ?history=1[&limit=&docId=] → { runs: ProcgenRun[] }, newest first
 *
 * History is the panel's seed memory: a re-roll is only safe because the seed it
 * replaced is still a row here.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('history')) {
      const rawDoc = searchParams.get('docId');
      const docId = rawDoc ? Number(rawDoc) : null;
      if (rawDoc && !Number.isInteger(docId)) return apiError('docId must be an integer', 400);
      return apiSuccess({
        runs: listProcgenRuns({ limit: searchParams.get('limit'), docId }),
      });
    }
    return apiSuccess(getLatestProcgenRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

/**
 * POST /api/level-design/procgen-result
 * Body: { roomCount, seed, algorithm?, params?, docId?, mapPath?, success?, failureReason? }
 *
 * `seed`, `docId`, `algorithm` and the requested room count arrive through the
 * task callback's staticFields, so they describe the run as DISPATCHED and a
 * prompt cannot rewrite them. A failed run is accepted (and stored) as long as
 * it names its reason — that row is the whole point.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Body must be valid JSON', 400);
  }

  const parsed = parseRunSubmission(body, 'roomCount');
  if (!parsed.ok) return apiError(parsed.error, 400);

  const { count, ...ledger } = parsed.data;
  try {
    return apiSuccess(recordProcgenRun({ ...ledger, roomCount: count }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
