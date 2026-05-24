import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
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
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const importedCount = Number(body.importedCount);
    const importDir = typeof body.importDir === 'string' ? body.importDir : '';
    if (!Number.isFinite(importedCount)) {
      return apiError('importedCount is a required number', 400);
    }
    return apiSuccess(recordMixamoRun({ importedCount, importDir }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
