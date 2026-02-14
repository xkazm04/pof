import { getAllFeatureStatuses } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const statuses = getAllFeatureStatuses();
    return apiSuccess({ statuses });
  } catch (error) {
    console.error('All statuses GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to read statuses', 500);
  }
}
