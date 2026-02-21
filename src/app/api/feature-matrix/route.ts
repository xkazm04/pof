import { NextRequest } from 'next/server';
import { getFeaturesByModule, getFeatureSummary, upsertFeatures, updateFeatureStatus } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

export async function GET(request: NextRequest) {
  try {
    const moduleId = request.nextUrl.searchParams.get('moduleId');
    if (!moduleId) {
      return apiError('moduleId is required', 400);
    }

    const features = getFeaturesByModule(moduleId as SubModuleId);
    const summary = getFeatureSummary(moduleId as SubModuleId);
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

    upsertFeatures(moduleId as SubModuleId, features);
    return apiSuccess({ count: features.length });
  } catch (error) {
    console.error('Feature matrix POST error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to save features', 500);
  }
}

/** PATCH — update a single feature's status (e.g., mark as implemented after CLI fix) */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { moduleId, featureName, status } = body as {
      moduleId?: string;
      featureName?: string;
      status?: FeatureStatus;
    };

    if (!moduleId || !featureName || !status) {
      return apiError('moduleId, featureName, and status are required', 400);
    }

    const validStatuses: FeatureStatus[] = ['implemented', 'improved', 'partial', 'missing', 'unknown'];
    if (!validStatuses.includes(status)) {
      return apiError(`Invalid status: ${status}`, 400);
    }

    updateFeatureStatus(moduleId as SubModuleId, featureName, status);
    return apiSuccess({ updated: true });
  } catch (error) {
    console.error('Feature matrix PATCH error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to update status', 500);
  }
}
