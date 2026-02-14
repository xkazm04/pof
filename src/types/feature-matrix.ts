export type FeatureStatus = 'implemented' | 'partial' | 'missing' | 'unknown';

export interface FeatureRow {
  id: number;
  moduleId: string;
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
  partial: number;
  missing: number;
  unknown: number;
}

/** Shape Claude writes to the JSON file */
export interface CLIFeatureReport {
  moduleId: string;
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
