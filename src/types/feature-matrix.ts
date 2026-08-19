import type { SubModuleId } from './modules';

/** Single source of truth for the five feature statuses. The type and all runtime
 *  validators (DB Set, route validator) derive from this tuple so they cannot drift. */
export const FEATURE_STATUSES = ['implemented', 'improved', 'partial', 'missing', 'unknown'] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

/**
 * Provenance: WHICH write path last set a row's status.
 *
 * The matrix is the evidence substrate the GDD compliance engine reads, and until
 * now a row could not say how it got its verdict. Four paths write rows and they
 * are not equally strong evidence:
 *   `review` — a CLI review read the code and gave a verdict (strongest);
 *   `verify` — a rule matched the live UE5 asset manifest (observed, narrow);
 *   `fix`    — the CLI that performed the change asserted the new state (self-reported);
 *   `seed`   — a static definition was inserted with no verdict at all;
 *   `unknown`— written before this column existed. Legacy rows say so honestly
 *              rather than being back-dated into a source nobody observed.
 */
export const FEATURE_SOURCES = ['review', 'verify', 'fix', 'seed', 'unknown'] as const;

export type FeatureSource = (typeof FEATURE_SOURCES)[number];

const VALID_SOURCES: ReadonlySet<string> = new Set(FEATURE_SOURCES);

/**
 * Normalize any stored/absent provenance to a `FeatureSource`. Every row read out
 * of SQLite carries one; the field stays optional on {@link FeatureRow} only so
 * synthetic row objects (fixtures, in-memory projections) need not invent one —
 * and those, correctly, read as `'unknown'`.
 */
export function normalizeFeatureSource(source: string | null | undefined): FeatureSource {
  return source && VALID_SOURCES.has(source) ? (source as FeatureSource) : 'unknown';
}

export interface FeatureRow {
  id: number;
  moduleId: SubModuleId;
  featureName: string;
  category: string;
  status: FeatureStatus;
  description: string;
  filePaths: string[];
  reviewNotes: string;
  qualityScore: number | null;
  nextSteps: string;
  lastReviewedAt: string | null;
  /** Which write path last set this row (see {@link FEATURE_SOURCES}). Always present
   *  on rows read from the DB; absent only on synthetic rows, which read `'unknown'`
   *  via {@link normalizeFeatureSource}. */
  source?: FeatureSource;
}

export interface FeatureSummary {
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
}

/** Shape Claude writes to the JSON file */
export interface CLIFeatureReport {
  moduleId: SubModuleId;
  reviewedAt: string;
  features: CLIFeatureEntry[];
}

export interface CLIFeatureEntry {
  featureName: string;
  category: string;
  status: FeatureStatus;
  description: string;
  filePaths: string[];
  reviewNotes: string;
  qualityScore?: number | null;
  nextSteps?: string;
}
