import { NextRequest } from 'next/server';
import { getFeaturesByModule, getFeatureSummary, upsertFeatures } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const moduleId = request.nextUrl.searchParams.get('moduleId');
    if (!moduleId) {
      return apiError('moduleId is required', 400);
    }

    const features = getFeaturesByModule(moduleId);
    const summary = getFeatureSummary(moduleId);
    return apiSuccess({ features, summary });
  } catch (error) {
    console.error('Feature matrix GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to read features', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moduleId, features } = body;

    if (!moduleId || !Array.isArray(features)) {
      return apiError('moduleId and features array required', 400);
    }

    upsertFeatures(moduleId, features);
    return apiSuccess({ count: features.length });
  } catch (error) {
    console.error('Feature matrix POST error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to save features', 500);
  }
}
