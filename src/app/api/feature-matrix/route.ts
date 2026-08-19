import { NextRequest } from 'next/server';
import { getFeaturesByModule, getFeatureSummary, upsertFeatures, updateFeatureStatus } from '@/lib/feature-matrix-db';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { FEATURE_STATUSES, FEATURE_SOURCES } from '@/types/feature-matrix';
import type { FeatureSource, FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

/** Resolve the provenance a POST claims. An unrecognized (or absent) `source` must
 *  never be able to claim a stronger path than it can prove, so it falls back to the
 *  weakest reading the call can still support: a seed batch is a seed, anything else
 *  is 'unknown'. */
function resolvePostSource(raw: unknown, seedOnly: boolean): FeatureSource {
  if (typeof raw === 'string' && (FEATURE_SOURCES as readonly string[]).includes(raw)) {
    return raw as FeatureSource;
  }
  return seedOnly ? 'seed' : 'unknown';
}

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

  const seedOnly = body.seedOnly === true;
  const source = resolvePostSource(body.source, seedOnly);
  upsertFeatures(moduleId as SubModuleId, features, { seedOnly, source });
  return apiSuccess({ count: features.length, source });
}, 'Failed to save features');

/**
 * PATCH — update a single feature's status (the CLI fix flow's callback).
 *
 * The write stamps provenance: `last_reviewed_at = now` and `source = 'fix'`, so the
 * compliance engine can no longer read a freshly-fixed row as evidence dated from an
 * older review that assessed a different status. See `updateFeatureStatus` for why a
 * fix counts as a dated assertion rather than being discounted at scoring time.
 *
 * A feature name that matches no row is now reported as `updated: false` with a 404
 * instead of a silent `{ updated: true }` over an UPDATE that touched nothing.
 */
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

  // A PATCH is the fix flow by default; an explicit, recognized `source` may say
  // otherwise. Anything unrecognized falls back to 'fix' rather than being trusted.
  const source: FeatureSource =
    typeof body.source === 'string' && (FEATURE_SOURCES as readonly string[]).includes(body.source)
      ? (body.source as FeatureSource)
      : 'fix';

  const result = updateFeatureStatus(moduleId as SubModuleId, featureName, status, { source });

  if (!result.updated) {
    return apiError(
      `No feature row for "${featureName}" in module "${moduleId}" — nothing was updated (seed the module or check the feature name)`,
      404,
    );
  }

  return apiSuccess({
    updated: true,
    previousStatus: result.previousStatus,
    statusChanged: result.statusChanged,
    reviewedAt: result.reviewedAt,
    source: result.source,
  });
}, 'Failed to update status');
