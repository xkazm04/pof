import { apiSuccess, apiError } from '@/lib/api-utils';
import { listBenchmarks } from '@/lib/benchmark-db';

/** GET /api/model-benchmarks — aggregated per-(taskClass, model, effort) benchmark medians. */
export function GET() {
  try {
    return apiSuccess(listBenchmarks());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'model-benchmarks GET failed', 500);
  }
}
