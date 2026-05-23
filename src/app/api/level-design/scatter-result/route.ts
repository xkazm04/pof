import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordScatterRun, getLatestScatterRun } from '@/lib/scatter-db';

// GET /api/level-design/scatter-result → latest run (or null)
export async function GET() {
  try {
    return apiSuccess(getLatestScatterRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// POST /api/level-design/scatter-result  Body: { instanceCount, seed }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const instanceCount = Number(body.instanceCount);
    const seed = Number(body.seed);
    if (!Number.isFinite(instanceCount) || !Number.isFinite(seed)) {
      return apiError('instanceCount and seed are required numbers', 400);
    }
    return apiSuccess(recordScatterRun({ instanceCount, seed }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
