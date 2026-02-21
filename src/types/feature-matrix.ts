import type { SubModuleId } from './modules';

export type FeatureStatus = 'implemented' | 'improved' | 'partial' | 'missing' | 'unknown';

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
