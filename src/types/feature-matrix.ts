import type { SubModuleId } from './modules';

/** Single source of truth for the five feature statuses. The type and all runtime
 *  validators (DB Set, route validator) derive from this tuple so they cannot drift. */
export const FEATURE_STATUSES = ['implemented', 'improved', 'partial', 'missing', 'unknown'] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

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
