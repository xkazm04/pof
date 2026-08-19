import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { upsertFeatures, normalizeProjectId } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { checkIdempotencyKey, saveIdempotencyResult } from '@/lib/request-log';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { CLIFeatureReport } from '@/types/feature-matrix';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { SubModuleId } from '@/types/modules';

/**
 * `reviewedAt` becomes `last_reviewed_at` — the evidence date the GDD compliance
 * engine ages every module's score against. It arrived as unvalidated free text
 * from a CLI report, so `"yesterday"` or `"2026-13-45"` landed in the column
 * verbatim and then sorted against real timestamps by raw character order.
 *
 * Rejected, not coerced: coercion here can only mean substituting `now`, which
 * invents an evidence date nobody observed — the exact failure the column exists to
 * prevent. A rejected report is a fixable CLI bug; a silently back-dated one is not
 * discoverable at all. Date-only (`2026-08-18`) is accepted and widened to UTC
 * midnight, since that is an unambiguous instant.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function parseReviewedAt(
  raw: unknown,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: new Date().toISOString() };
  }
  if (typeof raw !== 'string') {
    return { ok: false, reason: `reviewedAt must be an ISO-8601 date string; got ${typeof raw}` };
  }
  if (!ISO_DATE.test(raw)) {
    return {
      ok: false,
      reason: `reviewedAt "${raw}" is not an ISO-8601 date (expected e.g. 2026-08-18T12:00:00.000Z)`,
    };
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return { ok: false, reason: `reviewedAt "${raw}" is ISO-shaped but not a real date` };
  }
  // Store one canonical spelling so lexical order and chronological order agree.
  return { ok: true, value: new Date(ms).toISOString() };
}

// ── Zod schema for a single feature entry ──

const featureEntrySchema = z.object({
  featureName: z.string().min(1, 'featureName must be non-empty'),
  category: z.string().default('general'),
  status: z.enum(FEATURE_STATUSES),
  description: z.string().default(''),
  filePaths: z.array(z.string()).default([]),
  reviewNotes: z.string().default(''),
  qualityScore: z
    .number()
    .int()
    .min(1, 'qualityScore must be >= 1')
    .max(5, 'qualityScore must be <= 5')
    .nullable()
    .optional()
    .default(null),
  nextSteps: z.string().optional().default(''),
});

type ValidatedFeatureEntry = z.infer<typeof featureEntrySchema>;

interface ValidationResult {
  accepted: ValidatedFeatureEntry[];
  rejected: { featureName: string; reasons: string[] }[];
}

/**
 * Validate and filter feature entries against Zod schema and MODULE_FEATURE_DEFINITIONS.
 *
 * Each entry is validated individually so one bad entry doesn't reject the whole batch.
 * Features with hallucinated names (not in definitions) are rejected.
 */
function validateFeatures(moduleId: SubModuleId, rawFeatures: unknown[]): ValidationResult {
  const definitions = MODULE_FEATURE_DEFINITIONS[moduleId];
  const knownNames = definitions
    ? new Set(definitions.map(d => d.featureName))
    : null; // null means module has no definitions — skip name validation

  const accepted: ValidatedFeatureEntry[] = [];
  const rejected: ValidationResult['rejected'] = [];

  for (const raw of rawFeatures) {
    const reasons: string[] = [];

    // 1. Structural validation via Zod
    const parsed = featureEntrySchema.safeParse(raw);
    if (!parsed.success) {
      const name = (raw && typeof raw === 'object' && 'featureName' in raw)
        ? String((raw as Record<string, unknown>).featureName)
        : '<unknown>';
      reasons.push(...parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      rejected.push({ featureName: name, reasons });
      continue;
    }

    const entry = parsed.data;

    // 2. Feature name validation against known definitions
    if (knownNames && !knownNames.has(entry.featureName)) {
      reasons.push(
        `featureName "${entry.featureName}" not found in MODULE_FEATURE_DEFINITIONS for module "${moduleId}"`
      );
      rejected.push({ featureName: entry.featureName, reasons });
      continue;
    }

    accepted.push(entry);
  }

  return { accepted, rejected };
}

/**
 * Import feature review results.
 *
 * Accepts two modes:
 * 1. **Direct** (preferred): Full report body inline — `{ moduleId, reviewedAt, features: [...] }`
 * 2. **Legacy disk**: Module ID + project path — `{ moduleId, projectPath }` — reads from .pof/matrix/
 *
 * Each feature entry is validated against:
 * - Zod schema (structure, types, value ranges)
 * - MODULE_FEATURE_DEFINITIONS (hallucinated feature name detection)
 *
 * Valid features are imported; invalid ones are reported in the response.
 */
export const POST = withRoute(async (request: NextRequest) => {
  // Idempotency check: if the client sent an Idempotency-Key header, check for replay
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = checkIdempotencyKey(idempotencyKey);
    if (cached) {
      return new NextResponse(cached.responseBody, {
        status: cached.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const body = await request.json();
  const { moduleId: rawModuleId } = body;

  if (!rawModuleId || typeof rawModuleId !== 'string') {
    return apiError('moduleId is required', 400);
  }

  const moduleId = rawModuleId as SubModuleId;

  let report: CLIFeatureReport;

  // Direct mode: features array provided inline
  if (Array.isArray(body.features)) {
    report = {
      moduleId,
      reviewedAt: body.reviewedAt,
      features: body.features,
    };
  }
  // Legacy disk mode: read from .pof/matrix/ file
  else if (body.projectPath) {
    const filePath = path.join(body.projectPath, '.pof', 'matrix', `${moduleId}.json`);

    if (!fs.existsSync(filePath)) {
      return apiError(`Review results not found at ${filePath}`, 404);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      report = JSON.parse(raw);
    } catch {
      return apiError('Invalid JSON in review results file', 400);
    }
  } else {
    return apiError('Provide either features array (direct mode) or projectPath (disk mode)', 400);
  }

  if (!report.features || !Array.isArray(report.features)) {
    return apiError('Missing features array in report', 400);
  }

  // The evidence date is validated BEFORE any row is written — a report that cannot
  // say when it was produced must not be able to date rows the compliance engine reads.
  const reviewedAt = parseReviewedAt(report.reviewedAt);
  if (!reviewedAt.ok) {
    logger.warn(`[feature-matrix/import] rejected ${moduleId}: ${reviewedAt.reason}`);
    return apiError(reviewedAt.reason, 400);
  }

  // Validate all feature entries
  const { accepted, rejected } = validateFeatures(moduleId, report.features);

  if (accepted.length === 0 && rejected.length > 0) {
    return apiError('All features failed validation', 422, rejected);
  }

  // Map validated entries to upsert format
  const features = accepted.map((f) => ({
    featureName: f.featureName,
    category: f.category,
    status: f.status,
    description: f.description,
    filePaths: f.filePaths,
    reviewNotes: f.reviewNotes,
    qualityScore: f.qualityScore,
    nextSteps: f.nextSteps,
    lastReviewedAt: reviewedAt.value,
  }));

  // Which project this review is ABOUT. Disk mode already carries the project it
  // read the report from; direct mode may name it explicitly. Absent ⇒ the row is
  // written unattributed (`''`) — visible to every project, and counted as legacy
  // by the scope report, rather than being guessed onto one.
  const projectId = normalizeProjectId(
    typeof body.projectId === 'string' ? body.projectId
      : typeof body.projectPath === 'string' ? body.projectPath
      : '',
  );

  // This route IS the CLI review path — every row it writes is stamped as such.
  const upserted = upsertFeatures(moduleId, features, { source: 'review', projectId });

  const responseData = {
    imported: accepted.length,
    reviewedAt: reviewedAt.value,
    source: 'review' as const,
    projectId,
    // Structurally 0 since the UNIQUE key includes the project — an import can no
    // longer reassign another project's row. `claimedUnattributedRows` is the one
    // ownership change still possible: adopting a legacy (`project_id = ''`) row.
    takenOverFromOtherProjects: upserted.takenOver,
    claimedUnattributedRows: upserted.adoptedLegacy,
    ...(rejected.length > 0 ? { rejected } : {}),
  };

  if (idempotencyKey) {
    saveIdempotencyResult(idempotencyKey, '/api/feature-matrix/import', 200, responseData);
  }

  return apiSuccess(responseData);
}, 'Failed to import features');
