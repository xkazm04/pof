import type { SubModuleId } from './modules';

// ── Pattern categories ───────────────────────────────────────────────────────

export type PatternCategory =
  | 'class-hierarchy'
  | 'component-design'
  | 'state-machine'
  | 'data-flow'
  | 'gas-integration'
  | 'animation-setup'
  | 'ai-behavior'
  | 'ui-architecture'
  | 'save-system'
  | 'optimization'
  | 'general';

export type PatternConfidence = 'proven' | 'promising' | 'experimental';

// ── Core pattern ─────────────────────────────────────────────────────────────

export interface ImplementationPattern {
  id: string;
  /** Human-readable title, e.g. "GAS Combo System via Montage Sections" */
  title: string;
  /** Module this pattern applies to */
  moduleId: SubModuleId;
  /** Broader category */
  category: PatternCategory;
  /** Keywords for search */
  tags: string[];
  /** Markdown description of the pattern approach */
  description: string;
  /** The key architectural decision: e.g. "inheritance" | "composition" */
  approach: string;
  /** Success rate from sessions using this pattern (0–1) */
  successRate: number;
  /** Number of sessions that used this pattern */
  sessionCount: number;
  /** Number of distinct projects that used this pattern */
  projectCount: number;
  /** Average task duration in ms for sessions using this pattern */
  avgDurationMs: number;
  /** Confidence level based on sample size */
  confidence: PatternConfidence;
  /** Key C++ classes/structs involved */
  involvedClasses: string[];
  /** Common pitfalls discovered from failed sessions */
  pitfalls: string[];
  /** When this pattern was first observed */
  firstSeenAt: string;
  /** When this pattern was last used successfully */
  lastSuccessAt: string;
  /** Prompt snippet that represents this pattern's approach */
  examplePrompt?: string;
}

// ── Pattern match for suggestions ────────────────────────────────────────────

export interface PatternSuggestion {
  pattern: ImplementationPattern;
  /** 0–100 relevance score */
  relevance: number;
  /** Why this pattern was suggested */
  reason: string;
  /** Time savings vs average: positive = faster */
  timeSavingsMs: number;
}

// ── API types ────────────────────────────────────────────────────────────────

export interface PatternLibraryDashboard {
  patterns: ImplementationPattern[];
  totalPatterns: number;
  totalSessions: number;
  avgSuccessRate: number;
  topModules: { moduleId: SubModuleId; patternCount: number }[];
  categories: { category: PatternCategory; count: number }[];
}

export interface PatternSearchParams {
  query?: string;
  moduleId?: string;
  category?: PatternCategory;
  minSuccessRate?: number;
  sortBy?: 'success-rate' | 'usage' | 'recent' | 'duration';
}

// ── Anti-pattern (mined from failed sessions) ───────────────────────────────

export type AntiPatternSeverity = 'critical' | 'high' | 'medium';

export interface AntiPattern {
  id: string;
  /** Human-readable title, e.g. "Inheritance-Based GAS in arpg-gas" */
  title: string;
  moduleId: SubModuleId;
  category: PatternCategory;
  tags: string[];
  /** Why this is an anti-pattern */
  description: string;
  /** The approach that failed */
  approach: string;
  /** Failure rate (0–1), inverted from success rate */
  failureRate: number;
  /** Number of sessions that exhibited this anti-pattern */
  sessionCount: number;
  severity: AntiPatternSeverity;
  /** Keywords that trigger a match against user prompts */
  triggerKeywords: string[];
  /** Suggested better alternative (from successful patterns) */
  alternative?: {
    approach: string;
    successRate: number;
    title: string;
  };
  /** When first observed */
  firstSeenAt: string;
  /** Most recent failure */
  lastFailedAt: string;
  /** Example failed prompt snippet */
  examplePrompt?: string;
}

/** Warning shown before CLI submission when prompt matches an anti-pattern */
export interface AntiPatternWarning {
  antiPattern: AntiPattern;
  /** 0–100 match confidence */
  matchScore: number;
  /** Human-readable warning message */
  message: string;
}

/** DB row shape for anti_patterns table */
export interface AntiPatternRow {
  id: string;
  title: string;
  module_id: string;
  category: string;
  tags: string;
  description: string;
  approach: string;
  failure_rate: number;
  session_count: number;
  severity: string;
  trigger_keywords: string;
  alternative_json: string | null;
  first_seen_at: string;
  last_failed_at: string;
  example_prompt: string | null;
  created_at: string;
  updated_at: string;
}

// ── DB row shape ─────────────────────────────────────────────────────────────

export interface PatternRow {
  id: string;
  title: string;
  module_id: string;
  category: string;
  tags: string;
  description: string;
  approach: string;
  success_rate: number;
  session_count: number;
  project_count: number;
  avg_duration_ms: number;
  confidence: string;
  involved_classes: string;
  pitfalls: string;
  example_prompt: string | null;
  first_seen_at: string;
  last_success_at: string;
  created_at: string;
  updated_at: string;
}
