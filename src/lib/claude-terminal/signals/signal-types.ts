/**
 * Signal Types — Taxonomy for CLI self-improvement feedback loop.
 *
 * Signals are captured during CLI execution when tool errors, build failures,
 * N+1 queries, or other friction patterns are detected. They're aggregated into
 * Patterns which drive the improvement meta-agent.
 */

// ============ Enums ============

export type SignalType =
  | 'tool_error'           // Tool returned an error result
  | 'schema_mismatch'      // DB schema or type mismatch errors
  | 'tool_missing'         // Prompt references tool that doesn't exist
  | 'n_plus_one'           // Same tool called N times in sequence
  | 'prompt_hallucination' // CLI tries field/path that doesn't exist
  | 'retry_storm'          // Same tool retried 3+ times with same input
  | 'build_error'          // UE5/C++ compilation or linker error
  | 'performance'          // Execution took >60s for a simple task
  | 'type_drift';          // Tool input doesn't match expected schema

export type Severity = 'low' | 'medium' | 'high';

export type Category = 'schema' | 'prompt' | 'performance' | 'build' | 'tooling';

// ============ Signal ============

export interface Signal {
  id: string;
  type: SignalType;
  severity: Severity;
  category: Category;
  fingerprint: string;
  toolName?: string;
  errorMessage?: string;
  errorCode?: string;
  toolInput?: Record<string, unknown>;
  executionId: string;
  timestamp: number;
  resolved: boolean;
}

// ============ Pattern ============

export interface Pattern {
  fingerprint: string;
  type: SignalType;
  category: Category;
  severity: Severity;
  count: number;
  firstSeen: number;
  lastSeen: number;
  toolName?: string;
  errorMessage?: string;
  suggestedFix?: string;
  resolved: boolean;
}

// ============ Improvement Record ============

export interface ImprovementRecord {
  id: string;
  executionId: string;
  patternFingerprints: string[];
  startedAt: number;
  completedAt?: number;
  success: boolean;
  summary?: string;
  filesChanged?: string[];
}

// ============ Constants ============

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 3,
  high: 5,
};

export const SIGNAL_CATEGORY_MAP: Record<SignalType, Category> = {
  tool_error: 'tooling',
  schema_mismatch: 'schema',
  tool_missing: 'tooling',
  n_plus_one: 'performance',
  prompt_hallucination: 'prompt',
  retry_storm: 'performance',
  build_error: 'build',
  performance: 'performance',
  type_drift: 'schema',
};

export const SIGNAL_SEVERITY_MAP: Record<SignalType, Severity> = {
  tool_error: 'medium',
  schema_mismatch: 'high',
  tool_missing: 'medium',
  n_plus_one: 'low',
  prompt_hallucination: 'high',
  retry_storm: 'medium',
  build_error: 'high',
  performance: 'low',
  type_drift: 'medium',
};
