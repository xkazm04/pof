import { NextRequest } from 'next/server';
import { apiSuccess, apiError, readJsonObject } from '@/lib/api-utils';
import { recordMixamoRun, getLatestMixamoRun } from '@/lib/mixamo-db';

// GET /api/animations/mixamo-result → latest run (or null)
export async function GET() {
  try {
    return apiSuccess(getLatestMixamoRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// POST /api/animations/mixamo-result  Body: { importedCount, importDir }
/**
 * A count is a non-negative integer, given as a number or a numeric string. `Number()` alone
 * turned null, '' and ' ' into 0 and true into 1, so a callback that failed to count was
 * stored as a real run that imported nothing.
 */
function parseCount(v: unknown): number | null {
  if (typeof v !== 'number' && !(typeof v === 'string' && v.trim() !== '')) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function POST(req: NextRequest) {
  const parsedBody = await readJsonObject(req);
  if (!parsedBody.ok) return parsedBody.error;
  const body = parsedBody.data;
  try {
    const importedCount = parseCount(body.importedCount);
    const importDir = typeof body.importDir === 'string' ? body.importDir : '';
    if (importedCount === null) {
      return apiError('importedCount is a required non-negative integer', 400);
    }
    return apiSuccess(recordMixamoRun({ importedCount, importDir }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
