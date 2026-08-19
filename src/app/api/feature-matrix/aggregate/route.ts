import { getAllModuleAggregates } from '@/lib/feature-matrix-db';
import { apiSuccess, withRoute } from '@/lib/api-utils';

/**
 * Per-module roll-up of the feature matrix. Read through the ONE shared client
 * path (`useModuleAggregates`), so a single Evaluator mount runs this query once
 * rather than once per dashboard.
 */
export const GET = withRoute(async () => {
  const modules = getAllModuleAggregates();
  return apiSuccess({ modules });
}, 'Failed to read aggregates');
