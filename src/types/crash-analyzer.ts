/* ------------------------------------------------------------------ */
/*  UE5 Crash Log Analyzer Types                                      */
/* ------------------------------------------------------------------ */

/** A single frame in a crash callstack */
export interface CallstackFrame {
  index: number;
  /** Raw address (e.g., 0x00007FF6A1234567) */
  address: string;
  /** Module name (e.g., UnrealEditor-MyGame-Win64-Debug.dll) */
  moduleName: string;
  /** Decoded function name (e.g., AARPGCharacterBase::HandleDeath) */
  functionName: string;
  /** Source file if available */
  sourceFile: string | null;
  /** Line number if available */
  lineNumber: number | null;
  /** Whether this frame is from game code (vs engine) */
  isGameCode: boolean;
  /** Whether this frame is the likely crash origin */
  isCrashOrigin: boolean;
}

/** Crash severity based on type and frequency */
export type CrashSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Crash type categories */
export type CrashType =
  | 'nullptr_deref'
  | 'access_violation'
  | 'assertion_failed'
  | 'ensure_failed'
  | 'gc_reference'
  | 'stack_overflow'
  | 'out_of_memory'
  | 'unhandled_exception'
  | 'fatal_error'
  | 'gpu_crash'
  | 'unknown';

/** Machine state at crash time */
export interface MachineState {
  platform: string;
  cpuBrand: string;
  gpuBrand: string;
  ramMB: number;
  osVersion: string;
  engineVersion: string;
  buildConfig: 'Debug' | 'Development' | 'Shipping' | 'Test';
  isEditor: boolean;
}

/** A parsed crash report */
export interface CrashReport {
  id: string;
  /** Timestamp of crash */
  timestamp: string;
  /** Crash type category */
  crashType: CrashType;
  /** Severity assessment */
  severity: CrashSeverity;
  /** The error/assert message */
  errorMessage: string;
  /** Full callstack frames */
  callstack: CallstackFrame[];
  /** Top game-code frame (the likely culprit) */
  culpritFrame: CallstackFrame | null;
  /** Machine state */
  machineState: MachineState;
  /** Source directory the crash was found in */
  crashDir: string;
  /** Which POF module this crash maps to */
  mappedModule: string | null;
  /** Raw log text */
  rawLog: string;
  /** Whether this has been analyzed by AI */
  analyzed: boolean;
}

/** AI-generated root cause analysis */
export interface CrashDiagnosis {
  crashId: string;
  /** One-line summary */
  summary: string;
  /** Detailed root cause explanation */
  rootCause: string;
  /** The specific UE5 pattern that caused this */
  uePattern: string;
  /** Confidence in diagnosis (0-1) */
  confidence: number;
  /** Suggested fix description */
  fixDescription: string;
  /** One-click CLI fix prompt */
  fixPrompt: string;
  /** Related POF checklist items to review */
  relatedChecklist: string[];
  /** Tags for pattern matching */
  tags: string[];
}

/** A recurring crash pattern */
export interface CrashPattern {
  id: string;
  /** Pattern name */
  name: string;
  /** Description of the pattern */
  description: string;
  /** How many times this pattern has been seen */
  occurrences: number;
  /** Crash IDs matching this pattern */
  crashIds: string[];
  /** The crash type this pattern produces */
  crashType: CrashType;
  /** Key function names that identify this pattern */
  signatureFunctions: string[];
  /** Whether this is a systemic issue */
  isSystemic: boolean;
  /** Common root cause */
  rootCause: string;
  /** First seen timestamp */
  firstSeen: string;
  /** Last seen timestamp */
  lastSeen: string;
}

/** Crash database statistics */
export interface CrashStats {
  totalCrashes: number;
  crashesByType: Record<CrashType, number>;
  crashesBySeverity: Record<CrashSeverity, number>;
  crashesByModule: Record<string, number>;
  patternsDetected: number;
  systemicIssues: number;
  /** Crashes in the last 24 hours */
  recentCrashes: number;
  /** Most common crash type */
  mostCommonType: CrashType;
  /** Module with most crashes */
  mostAffectedModule: string;
}

/** Full analyzer result */
export interface CrashAnalyzerResult {
  reports: CrashReport[];
  diagnoses: CrashDiagnosis[];
  patterns: CrashPattern[];
  stats: CrashStats;
}
