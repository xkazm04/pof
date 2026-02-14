// ─── AI Game Director Types ──────────────────────────────────────────────────

export type PlaytestStatus =
  | 'configuring'   // User setting up session params
  | 'launching'     // Build being launched
  | 'playing'       // Agent actively playing
  | 'analyzing'     // Post-play analysis in progress
  | 'complete'      // Report ready
  | 'failed';       // Error during session

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'positive';

export type FindingCategory =
  | 'visual-glitch'       // Z-fighting, texture pop-in, clipping
  | 'animation-issue'     // Jitter, blending errors, T-pose
  | 'gameplay-feel'       // Combat responsiveness, movement feel
  | 'ux-problem'          // Confusing UI, unclear feedback
  | 'performance'         // FPS drops, hitches, memory
  | 'crash-bug'           // Hard crash or freeze
  | 'level-pacing'        // Flow, difficulty, dead zones
  | 'audio-issue'         // Missing sounds, balance, spatial
  | 'save-load'           // Corruption, missing state
  | 'ai-behavior'         // NPC issues, pathfinding, stuck
  | 'positive-feedback';  // Things that work well

export type TestCategory =
  | 'combat'
  | 'exploration'
  | 'dialogue'
  | 'save-load'
  | 'ui-navigation'
  | 'ai-behavior'
  | 'performance-stress'
  | 'visual-quality';

export interface PlaytestSession {
  id: string;
  name: string;
  status: PlaytestStatus;
  buildPath: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  config: PlaytestConfig;
  summary: PlaytestSummary | null;
  systemsTestedCount: number;
  findingsCount: number;
}

export interface PlaytestConfig {
  /** Which test categories to focus on */
  testCategories: TestCategory[];
  /** How long to play (minutes) */
  maxPlaytimeMinutes: number;
  /** Screenshot interval (seconds) for visual analysis */
  screenshotIntervalSeconds: number;
  /** Whether to stress-test edge cases aggressively */
  aggressiveMode: boolean;
  /** Specific systems to prioritize from feature matrix */
  prioritySystems: string[];
}

export interface PlaytestSummary {
  overallScore: number;          // 0-100
  totalScreenshotsAnalyzed: number;
  systemsTested: string[];
  testCoverage: Record<TestCategory, number>; // 0-100 per category
  topIssue: string;
  topPraise: string;
  playtimeSeconds: number;
}

export interface PlaytestFinding {
  id: string;
  sessionId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  /** Which system/module this finding relates to */
  relatedModule: string | null;
  /** Screenshot path or base64 (if captured) */
  screenshotRef: string | null;
  /** Game timestamp when the finding was recorded */
  gameTimestamp: number | null;
  /** Suggested fix or improvement */
  suggestedFix: string;
  /** Confidence 0-100 that this is a real issue */
  confidence: number;
  createdAt: string;
}

export interface DirectorEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'action' | 'observation' | 'screenshot' | 'finding' | 'system-test' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

// ─── API Payloads ────────────────────────────────────────────────────────────

export interface CreateSessionPayload {
  name: string;
  buildPath: string;
  config: PlaytestConfig;
}

export interface StartSessionPayload {
  sessionId: string;
}
