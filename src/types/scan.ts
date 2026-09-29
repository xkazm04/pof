import type { EvalPass } from '@/lib/evaluator/module-eval-prompts';

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
  /** The scan run that reported it (`module_scans.scan_id`). */
  scanId?: string;
  /** Set server-side (`eval_findings.resolved_at`); survives reloads, cleared by an undo. */
  resolvedAt?: string;
}

/** One recorded scan run — a `module_scans` row. Written for clean scans too. */
export interface ScanRecord {
  scanId: string;
  moduleId: string;
  /** Every pass the scan covered, including passes that found nothing. */
  passes: EvalPass[];
  findingCount: number;
  createdAt: string;
}

/**
 * The latest scan reconciled against the findings still unresolved before it
 * (`reconcileScan`). Every list holds finding ids.
 */
export interface ScanDelta {
  scan: ScanRecord;
  /** Unresolved findings from earlier scans — the set the latest scan was judged against. */
  prior: string[];
  new: string[];
  persisting: string[];
  cleared: string[];
  /** Earlier findings whose pass the latest scan did not run: never counted as cleared. */
  notRescanned: string[];
}

/** What the Scan tab can honestly say about the most recent scan. */
export type ScanDeltaState =
  | { status: 'none' }
  | { status: 'pending' }
  | { status: 'recorded'; delta: ScanDelta }
  | { status: 'unrecorded'; reason: string };
