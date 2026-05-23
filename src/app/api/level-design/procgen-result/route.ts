import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordProcgenRun, getLatestProcgenRun } from '@/lib/procgen-db';

// GET /api/level-design/procgen-result → latest run (or null)
export async function GET() {
  try {
    return apiSuccess(getLatestProcgenRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// POST /api/level-design/procgen-result  Body: { roomCount, seed }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCount = Number(body.roomCount);
    const seed = Number(body.seed);
    if (!Number.isFinite(roomCount) || !Number.isFinite(seed)) {
      return apiError('roomCount and seed are required numbers', 400);
    }
    return apiSuccess(recordProcgenRun({ roomCount, seed }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
