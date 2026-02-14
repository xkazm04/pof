import { NextRequest } from 'next/server';
import { getReviewHistory, getAllReviewHistory } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const moduleId = request.nextUrl.searchParams.get('moduleId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);
    const safeLimit = Math.min(100, Math.max(1, limit));

    if (moduleId) {
      const snapshots = getReviewHistory(moduleId, safeLimit);
      return apiSuccess({ snapshots });
    }

    // No moduleId → return all modules' history (for aggregate dashboard)
    const history = getAllReviewHistory(safeLimit);
    return apiSuccess({ history });
  } catch (error) {
    console.error('Review history GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to read history', 500);
  }
}
