// ── Anti-pattern categories ──

export type AntiPatternCategory =
  | 'missing-generated-body'
  | 'circular-include'
  | 'hard-coded-asset-path'
  | 'untracked-newobject'
  | 'deprecated-api'
  | 'god-class';

export type Severity = 'critical' | 'warning' | 'info';

export interface AntiPatternHit {
  id: string;
  category: AntiPatternCategory;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

// ── Git churn metrics ──

export interface FileChurn {
  file: string;
  commits: number;
  authors: number;
  lastModified: string;
}

export interface ShotgunSurgery {
  commit: string;
  message: string;
  filesChanged: number;
  date: string;
}

// ── Aggregate analysis ──

export interface RefactoringItem {
  file: string;
  score: number;           // coupling * churn — higher = more urgent
  churn: number;
  antiPatterns: number;
  topCategory: AntiPatternCategory;
  severity: Severity;
}

export interface ArcheologistAnalysis {
  scannedAt: string;
  scanDurationMs: number;
  totalFiles: number;
  totalAntiPatterns: number;
  bySeverity: { critical: number; warning: number; info: number };
  byCategory: Record<AntiPatternCategory, number>;
  antiPatterns: AntiPatternHit[];
  churn: FileChurn[];
  shotgunSurgeries: ShotgunSurgery[];
  refactoringBacklog: RefactoringItem[];
}
