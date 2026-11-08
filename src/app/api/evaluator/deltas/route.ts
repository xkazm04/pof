import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getScanHistory } from '@/lib/evaluator/evaluator-results-db';
import { deriveScanDeltas } from '@/lib/evaluator/scan-delta';

/**
 * The evaluator scan-delta feed consumed by the Game Director's regression
 * tracker: per-scan NEW / RESOLVED / PERSISTING counts derived from scan history.
 * `?limit=N` bounds how many recent scans are diffed; `?project=` scopes it.
 * Empty history → `{ deltas: [] }` (the tracker then renders exactly as before).
 */
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project') || undefined;
  const limitRaw = searchParams.get('limit');
  const limitParsed = limitRaw === null ? 30 : Number(limitRaw);
  if (limitRaw !== null && (limitRaw.trim() === '' || !Number.isInteger(limitParsed) || limitParsed < 1)) {
    return apiError('limit must be an integer >= 1', 400);
  }
  const limit = Math.min(limitParsed, 200);

  const scans = getScanHistory(limit, projectId);
  return apiSuccess({ deltas: deriveScanDeltas(scans) });
}, 'Failed to derive scan deltas');
