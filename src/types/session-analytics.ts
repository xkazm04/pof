// ── Session record — one per CLI task execution ──

export interface SessionRecord {
  id: number;
  moduleId: string;
  sessionKey: string;
  prompt: string;
  /** First 80 chars of prompt, for quick display */
  promptPreview: string;
  /** Whether context injection was used (buildChecklistPrompt) */
  hadProjectContext: boolean;
  /** Prompt length in characters */
  promptLength: number;
  /** Outcome */
  success: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamps */
  startedAt: string;
  completedAt: string;
}

// ── Module-level stats ──

export interface ModuleStats {
  moduleId: string;
  totalSessions: number;
  successCount: number;
  failCount: number;
  successRate: number;
  avgDurationMs: number;
  avgSuccessDurationMs: number;
  avgFailDurationMs: number;
  /** Sessions with context injection */
  contextInjectedCount: number;
  contextInjectedSuccessRate: number;
  /** Sessions without context injection */
  noContextCount: number;
  noContextSuccessRate: number;
}

// ── Prompt pattern insight ──

export type InsightType =
  | 'context-injection'
  | 'prompt-length'
  | 'module-success-rate'
  | 'time-of-day'
  | 'prompt-prefix';

export interface PromptInsight {
  type: InsightType;
  moduleId: string;
  message: string;
  /** Improvement factor (e.g., 3.0 = "3x more likely to succeed") */
  factor: number;
  /** How confident we are (0-1), based on sample size */
  confidence: number;
  /** Actionable suggestion */
  suggestion: string;
}

// ── Per-module prompt quality score ──

export interface PromptQualityScore {
  moduleId: string;
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  recentSuccessRate: number; // last 10 sessions
  overallSuccessRate: number;
  sessionsRecorded: number;
}

// ── Aggregate dashboard stats ──

export interface AnalyticsDashboard {
  totalSessions: number;
  overallSuccessRate: number;
  totalDurationMs: number;
  moduleStats: ModuleStats[];
  insights: PromptInsight[];
  qualityScores: PromptQualityScore[];
  recentSessions: SessionRecord[];
}

// ── Prompt suggestion (shown before sending) ──

export interface PromptSuggestion {
  type: 'add-context' | 'shorten' | 'lengthen' | 'rephrase' | 'module-tip';
  message: string;
  confidence: number;
}
