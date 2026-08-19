import { NextRequest } from 'next/server';
import {
  getFeaturesByModule, getFeatureSummary, upsertFeatures, updateFeatureStatus,
  getProjectScopeReport, normalizeProjectId,
} from '@/lib/feature-matrix-db';
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

/**
 * The active project, taken EXPLICITLY from the caller — `projectId` (or the
 * `projectPath` the rest of the app already passes around, which is the same
 * value). Nothing here infers it: a server-side read that guessed its own scope
 * would be the silent mis-attribution the scoping exists to remove. Absent ⇒ `''`,
 * the unscoped/legacy set, and every response says so via `scope`.
 */
function resolveProjectId(source: { get(key: string): string | null }): string {
  return normalizeProjectId(source.get('projectId') ?? source.get('projectPath'));
}

function bodyProjectId(body: Record<string, unknown>): string {
  const raw = body.projectId ?? body.projectPath;
  return normalizeProjectId(typeof raw === 'string' ? raw : '');
}

export const GET = withRoute(async (request: NextRequest) => {
  const moduleId = request.nextUrl.searchParams.get('moduleId');
  if (!moduleId) {
    return apiError('moduleId is required', 400);
  }

  const projectId = resolveProjectId(request.nextUrl.searchParams);
  const features = getFeaturesByModule(moduleId as SubModuleId, projectId);
  const summary = getFeatureSummary(moduleId as SubModuleId, projectId);
  // `scope` travels with the rows so a caller can never mistake a scoped read for a
  // project-wide one, and an empty module can say whether it is genuinely empty or
  // whether another project holds its rows.
  const scope = getProjectScopeReport(projectId, moduleId);
  return apiSuccess({ features, summary, scope });
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
  const projectId = bodyProjectId(body);
  const result = upsertFeatures(moduleId as SubModuleId, features, { seedOnly, source, projectId });
  // `takenOver` is reported, not swallowed: under the phase-1 UNIQUE key a feature
  // is one row, so writing under project B can reassign rows project A was reading.
  return apiSuccess({
    count: features.length,
    source,
    projectId: result.projectId,
    written: result.written,
    takenOverFromOtherProjects: result.takenOver,
  });
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

  const projectId = bodyProjectId(body);
  const result = updateFeatureStatus(moduleId as SubModuleId, featureName, status, {
    source,
    projectId,
  });

  if (!result.updated) {
    // A row held by ANOTHER project is a different failure from a missing row, and
    // must say so — silently reporting "no such feature" for a row that plainly
    // exists is the mis-attribution this scoping removes.
    if (result.foreignOwner) {
      return apiError(
        `"${featureName}" in module "${moduleId}" belongs to project "${result.foreignOwner}", not to ` +
          `"${projectId || '(unscoped)'}" — nothing was updated. One feature is one row until the ` +
          `UNIQUE key includes the project (phase 2).`,
        409,
      );
    }
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
    projectId,
  });
}, 'Failed to update status');
