import type { FeatureStatus } from './feature-matrix';
import type { SubModuleId } from './modules';

export type GapSeverity = 'critical' | 'major' | 'minor' | 'info';
export type GapDirection = 'design-ahead' | 'code-ahead';
export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large';

export interface ComplianceGap {
  id: string;
  moduleId: SubModuleId;
  moduleName: string;
  category: string;
  title: string;
  description: string;
  direction: GapDirection;
  severity: GapSeverity;
  effort: EffortEstimate;
  designState: string;
  codeState: string;
  suggestion: string;
  resolved: boolean;
}

export interface ModuleCompliance {
  moduleId: SubModuleId;
  moduleName: string;
  score: number;             // 0-100
  totalFeatures: number;
  implemented: number;
  partial: number;
  missing: number;
  checklistTotal: number;
  checklistDone: number;
  gaps: ComplianceGap[];
}

export interface ComplianceReport {
  generatedAt: string;
  overallScore: number;       // 0-100 weighted average
  modules: ModuleCompliance[];
  totalGaps: number;
  criticalGaps: number;
  suggestions: ReconciliationSuggestion[];
}

export interface ReconciliationSuggestion {
  id: string;
  moduleId: SubModuleId;
  type: 'update-gdd' | 'implement-feature' | 'remove-stale';
  title: string;
  description: string;
  effort: EffortEstimate;
  priority: number;           // 1 = highest
}

export interface ComplianceRequest {
  action: 'audit' | 'get-report' | 'resolve-gap' | 'apply-suggestion';
  moduleId?: string;
  gapId?: string;
  suggestionId?: string;
}
