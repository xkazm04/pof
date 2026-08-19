// ─── AI Game Director Types ──────────────────────────────────────────────────

export type PlaytestStatus =
  | 'configuring'   // User setting up session params
  | 'launching'     // Build being launched
  | 'playing'       // Agent actively playing
  | 'analyzing'     // Post-play analysis in progress
  | 'complete'      // Report ready
  | 'failed';       // Error during session

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'positive';

/**
 * Triage state of a finding. `active` is the default — finding is real and unreviewed.
 * `confirmed` is a human-confirmed real issue. `false-positive` and `ignore` exclude
 * the finding from regression fingerprinting and health scoring. `snooze` keeps it in
 * scoring but hides it until snoozedUntil expires.
 */
export type TriageStatus =
  | 'active'
  | 'confirmed'
  | 'false-positive'
  | 'ignore'
  | 'snooze';

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

/**
 * Where a session's numbers came from.
 *
 * `simulated` — produced by `game-director-sim.ts`, the in-repo dev fixture. Its
 * findings are canned templates and its score is arithmetic over them; NO build
 * was launched, no frame was captured, nothing was measured.
 * `external` — written through the game-director writer API (update-status /
 * add-finding / add-event / complete) by a real harness (Gauntlet, the pof-mcp
 * headless runner, a human).
 *
 * Optional on the interface only so hand-built session objects (tests, fixtures)
 * stay valid: **absent means `simulated`**, never "verified". Resolve it with
 * `resolveSessionSource()` rather than reading the field directly.
 */
export type SessionSource = 'simulated' | 'external';

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
  /** Provenance of every number on this session. Absent ⇒ `simulated`. */
  source?: SessionSource;
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
  /**
   * Screenshots actually analyzed. `null` = nothing was captured, so the count
   * is not measured — the simulator writes null because it captures no frames.
   */
  totalScreenshotsAnalyzed: number | null;
  systemsTested: string[];
  /**
   * 0-100 per category, or `null` for "not measured" — a category nothing
   * actually exercised has no coverage figure, and a made-up one is worse than
   * an absent one.
   */
  testCoverage: Record<TestCategory, number | null>;
  topIssue: string;
  topPraise: string;
  /** Seconds of game time played, or `null` when no build was played. */
  playtimeSeconds: number | null;
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
  /** Human triage decision; 'active' for newly-recorded findings */
  triageStatus: TriageStatus;
  /** Optional note explaining the triage decision */
  triageNote: string;
  /** ISO timestamp until which a snoozed finding stays hidden */
  snoozedUntil: string | null;
  /**
   * ISO timestamp of the moment a one-click "Fix this" CLI repair task was
   * dispatched for this finding, or null if none has been. Links the finding to
   * its repair attempt so the regression tracker can later confirm the fix held.
   */
  fixDispatchedAt: string | null;
}

export interface UpdateTriagePayload {
  findingId: string;
  triageStatus: TriageStatus;
  triageNote?: string;
  /** Required when triageStatus = 'snooze'; ISO datetime */
  snoozedUntil?: string | null;
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
  /**
   * Declared provenance of the session being created. Omitted ⇒ `simulated`.
   * A real harness creating a session it will fill through the writer API
   * passes `'external'`.
   */
  source?: SessionSource;
}

export interface StartSessionPayload {
  sessionId: string;
}
