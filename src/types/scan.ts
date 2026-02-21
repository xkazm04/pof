export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ScanEffort = 'trivial' | 'small' | 'medium' | 'large';

export interface ScanFinding {
  id: string;
  pass: 'structure' | 'quality' | 'performance';
  category: string;
  severity: ScanSeverity;
  file: string | null;
  line: number | null;
  description: string;
  suggestedFix: string;
  effort: ScanEffort;
  foundAt: string;
  resolvedAt?: string;
}
