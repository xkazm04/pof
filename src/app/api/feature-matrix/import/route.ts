import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { upsertFeatures } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { checkIdempotencyKey, saveIdempotencyResult } from '@/lib/request-log';
import type { CLIFeatureReport } from '@/types/feature-matrix';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';

// ── Zod schema for a single feature entry ──

const featureEntrySchema = z.object({
  featureName: z.string().min(1, 'featureName must be non-empty'),
  category: z.string().default('general'),
  status: z.enum(['implemented', 'improved', 'partial', 'missing', 'unknown']),
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
export async function POST(request: NextRequest) {
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

  try {
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
        reviewedAt: body.reviewedAt || new Date().toISOString(),
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
      lastReviewedAt: report.reviewedAt || new Date().toISOString(),
    }));

    upsertFeatures(moduleId, features);

    const responseData = {
      imported: accepted.length,
      ...(rejected.length > 0 ? { rejected } : {}),
    };

    if (idempotencyKey) {
      saveIdempotencyResult(idempotencyKey, '/api/feature-matrix/import', 200, responseData);
    }

    return apiSuccess(responseData);
  } catch (error) {
    console.error('Feature matrix import error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to import features', 500);
  }
}
