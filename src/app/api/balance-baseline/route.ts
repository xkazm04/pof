import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getBaseline, upsertBaseline } from '@/lib/balance/baseline-db';
import type { BalanceBaseline } from '@/lib/balance/baseline';
import type { StatRow } from '@/lib/balance/threat-score';

/** GET /api/balance-baseline?catalogId=bestiary&entityId=brute → BalanceBaseline | null */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    return apiSuccess(getBaseline(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Baseline GET failed', 500);
  }
}

/** POST /api/balance-baseline { catalogId, entityId, threatScore, stats } → upsert */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => undefined);
    // A body that is not a JSON object is the caller's error (400), not a server fault.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    if (typeof body.threatScore !== 'number') return apiError('threatScore (number) is required', 400);
    if (!Array.isArray(body.stats)) return apiError('stats (array) is required', 400);

    // Each row is read as { label: string, value: number } by the threat-score reader.
    const badRow = (body.stats as unknown[]).findIndex((r) => {
      if (typeof r !== 'object' || r === null || Array.isArray(r)) return true;
      const row = r as Record<string, unknown>;
      return typeof row.label !== 'string' || typeof row.value !== 'number' || !Number.isFinite(row.value);
    });
    if (badRow >= 0) return apiError(`stats[${badRow}] must be an object with a string label and a finite number value`, 400);

    const record: BalanceBaseline = {
      catalogId,
      entityId,
      threatScore: body.threatScore,
      stats: body.stats as StatRow[],
    };
    return apiSuccess(upsertBaseline(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Baseline POST failed', 500);
  }
}
