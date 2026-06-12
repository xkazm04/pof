import { NextRequest } from 'next/server';
import { getFeaturesByModule, getFeatureSummary, upsertFeatures, updateFeatureStatus } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

export const GET = withRoute(async (request: NextRequest) => {
  const moduleId = request.nextUrl.searchParams.get('moduleId');
  if (!moduleId) {
    return apiError('moduleId is required', 400);
  }

  const features = getFeaturesByModule(moduleId as SubModuleId);
  const summary = getFeatureSummary(moduleId as SubModuleId);
  return apiSuccess({ features, summary });
}, 'Failed to read features');

export const POST = withRoute(async (request: NextRequest) => {
  const body = await request.json();
  const { moduleId, features } = body;

  if (!moduleId || !Array.isArray(features)) {
    return apiError('moduleId and features array required', 400);
  }

  // upsertFeatures is a FULL upsert — undefined required columns crash in the
  // better-sqlite3 bind layer as an unactionable 500. Reject partial rows
  // loudly; status-only updates belong on PATCH.
  for (const f of features) {
    if (
      typeof f?.featureName !== 'string' || !f.featureName ||
      typeof f.category !== 'string' ||
      typeof f.description !== 'string' ||
      !Array.isArray(f.filePaths) ||
      typeof f.reviewNotes !== 'string'
    ) {
      return apiError(
        `features[] rows must be complete upsert rows (featureName, category, description, filePaths[], reviewNotes); got a partial row for "${f?.featureName ?? '?'}" — use PATCH for status-only updates`,
        400,
      );
    }
  }

  upsertFeatures(moduleId as SubModuleId, features);
  return apiSuccess({ count: features.length });
}, 'Failed to save features');

/** PATCH — update a single feature's status (e.g., mark as implemented after CLI fix) */
export const PATCH = withRoute(async (request: NextRequest) => {
  const body = await request.json();
  const { moduleId, featureName, status } = body as {
    moduleId?: string;
    featureName?: string;
    status?: FeatureStatus;
  };

  if (!moduleId || !featureName || !status) {
    return apiError('moduleId, featureName, and status are required', 400);
  }

  if (!FEATURE_STATUSES.includes(status)) {
    return apiError(`Invalid status: ${status}`, 400);
  }

  updateFeatureStatus(moduleId as SubModuleId, featureName, status);
  return apiSuccess({ updated: true });
}, 'Failed to update status');
