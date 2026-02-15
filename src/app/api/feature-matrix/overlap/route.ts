import { analyzeOverlaps } from '@/lib/overlap-detection';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const report = analyzeOverlaps();
    return apiSuccess({ report });
  } catch (error) {
    console.error('Overlap analysis error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to analyze overlaps', 500);
  }
}
