import { getAllModuleAggregates } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const modules = getAllModuleAggregates();
    return apiSuccess({ modules });
  } catch (error) {
    console.error('Aggregate GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to read aggregates', 500);
  }
}
