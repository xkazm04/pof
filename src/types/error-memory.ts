import type { SubModuleId } from './modules';

// ── Error fingerprint categories ──

export type ErrorCategory =
  | 'missing-include'
  | 'unresolved-external'
  | 'gc-issue'
  | 'type-mismatch'
  | 'missing-module-dep'
  | 'uclass-macro'
  | 'forward-declaration'
  | 'linker-duplicate'
  | 'syntax'
  | 'access-specifier'
  | 'generated-header'
  | 'other';

// ── Stored error memory record ──

export interface ErrorMemoryRecord {
  id: number;
  /** The module this error occurred in (e.g., "arpg-combat") */
  moduleId: SubModuleId;
  /** Fingerprint hash — groups identical errors across sessions */
  fingerprint: string;
  /** Human-readable category */
  category: ErrorCategory;
  /** Compiler error code if available (e.g., C2065, LNK2019) */
  errorCode: string | null;
  /** The key pattern (e.g., "AbilitySystemComponent.h") */
  pattern: string;
  /** Full error message from first occurrence */
  message: string;
  /** File where error occurred (relative path) */
  file: string | null;
  /** One-line fix description learned from resolution */
  fixDescription: string;
  /** Number of times this exact fingerprint occurred */
  occurrences: number;
  /** When this was first seen */
  firstSeenAt: string;
  /** When this was last seen */
  lastSeenAt: string;
  /** Whether the error was eventually resolved in the same session */
  wasResolved: boolean;
}

// ── Fingerprinted error — before storage ──

export interface FingerprintedError {
  fingerprint: string;
  category: ErrorCategory;
  errorCode: string | null;
  pattern: string;
  message: string;
  file: string | null;
  fixDescription: string;
}

// ── Error context injection — what gets added to prompts ──

export interface ErrorContextEntry {
  category: ErrorCategory;
  pattern: string;
  fixDescription: string;
  occurrences: number;
  errorCode: string | null;
}

// ── API types ──

export interface ErrorMemoryRequest {
  action:
    | 'record-errors'
    | 'get-module-errors'
    | 'get-relevant-errors'
    | 'mark-resolved'
    | 'get-stats';
  moduleId?: string;
  errors?: { message: string; code: string | null; file: string | null; category: string }[];
  fingerprint?: string;
  /** Keywords from the current task for relevance matching */
  taskKeywords?: string[];
}
