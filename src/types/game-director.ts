// ─── AI Game Director Types ──────────────────────────────────────────────────

import { ok, err, type Result } from '@/types/result';

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
 *
 * `unreproducible` is a **durable state, not a dismissal**: somebody pulled the
 * trigger a stated number of times on a stated build and the failure did not
 * occur. Failing to reproduce is weak evidence *against* a defect while
 * reproducing is strong evidence *for* one, so the state never converts to
 * "works as intended", never leaves scoring, and always carries its attempt
 * count — a "could not reproduce" with no denominator is a verdict reported over
 * an unstated scope. It is distinct from `false-positive` (the finding was
 * wrong), from `ignore` (the finding is real and we accept it) and from `snooze`
 * (the parking lot that loses the signal with no record anyone ever looked).
 */
export type TriageStatus =
  | 'active'
  | 'confirmed'
  | 'false-positive'
  | 'ignore'
  | 'snooze'
  | 'unreproducible';

/** Every triage state, in the order the UI offers them. */
export const TRIAGE_STATUSES: readonly TriageStatus[] = [
  'active',
  'confirmed',
  'false-positive',
  'ignore',
  'snooze',
  'unreproducible',
] as const;

export function isTriageStatus(value: unknown): value is TriageStatus {
  return typeof value === 'string' && (TRIAGE_STATUSES as readonly string[]).includes(value);
}

/**
 * Where a finding's `confidence` number came from.
 *
 * `observer` — an observer (human or automated tester) actually scored this
 * finding. The number is a measurement.
 * `unattributed` — a number exists but nothing recorded who or what produced it.
 * Every row written while the column was `INTEGER NOT NULL DEFAULT 80` is in this
 * class: an unscored finding and a finding scored at 80 were stored identically
 * and cannot be told apart after the fact. Read as "not a measurement", never as
 * a score.
 *
 * A finding nobody scored carries `confidence: null` and no basis at all.
 */
export type ConfidenceBasis = 'observer' | 'unattributed';

/**
 * The record of an attempt series behind an `unreproducible` verdict. `attempts`
 * is never defaulted and never zero — zero attempts is "not attempted", which is
 * a different (and honest) state carried by `active`.
 */
export interface ReproRecord {
  /** How many times reproduction was attempted. Always >= 1. */
  attempts: number;
  /** Build identity the attempts ran against, or null when it was not recorded. */
  buildId: string | null;
}

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
  /**
   * Confidence 0-100 that this is a real issue, or `null` when **nobody scored
   * it**. Never defaulted: an unscored finding that renders as a number is
   * indistinguishable from a measured one, which is the whole defect this field
   * used to carry (`INTEGER NOT NULL DEFAULT 80`).
   */
  confidence: number | null;
  /**
   * Provenance of {@link confidence}. Optional on the interface only so
   * hand-built finding objects stay valid: **absent means `unattributed`**, never
   * `observer`. Resolve it with `resolveConfidence()` rather than reading the
   * field directly.
   */
  confidenceBasis?: ConfidenceBasis | null;
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
  /**
   * How many times reproduction was attempted, or `null`/absent when nobody has
   * tried. Set together with `triageStatus: 'unreproducible'` and cleared when the
   * finding is reopened. Optional on the interface so hand-built findings stay
   * valid: **absent means not attempted**, which is a statement about the queue
   * rather than about the defect — never "we looked and it is fine".
   */
  reproAttempts?: number | null;
  /** Build identity the attempts ran against, or null when unrecorded. */
  reproBuildId?: string | null;
  /** ISO timestamp of the moment the attempt series was recorded. */
  reproLastAttemptedAt?: string | null;
}

export interface UpdateTriagePayload {
  findingId: string;
  triageStatus: TriageStatus;
  triageNote?: string;
  /** Required when triageStatus = 'snooze'; ISO datetime */
  snoozedUntil?: string | null;
  /** Required when triageStatus = 'unreproducible'; must be >= 1. */
  reproAttempts?: number | null;
  /** Optional build identity the attempts ran against. */
  reproBuildId?: string | null;
}

/**
 * Gate for the repro record attached to a triage write. `unreproducible` is the
 * one state that reports a verdict about the build, so it is the one state
 * required to prove it had input first: an attempt count of at least one. Every
 * other state carries no repro record, and setting one back to `active` clears
 * whatever series was recorded — the finding is unattempted again.
 */
export function validateTriageRepro(
  triageStatus: TriageStatus,
  attempts: number | null | undefined,
  buildId: string | null | undefined,
): Result<ReproRecord | null, string> {
  if (triageStatus !== 'unreproducible') return ok(null);
  if (typeof attempts !== 'number' || !Number.isFinite(attempts) || !Number.isInteger(attempts)) {
    return err('reproAttempts is required for an unreproducible finding — "could not reproduce" with no attempt count states nothing about reliability');
  }
  if (attempts < 1) {
    return err('reproAttempts must be at least 1 — zero attempts is "not attempted", not "unreproducible"');
  }
  return ok({ attempts, buildId: buildId ?? null });
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

// ─── Confidence ──────────────────────────────────────────────────────────────

/**
 * What a finding's confidence field is actually entitled to say. Three outcomes,
 * never two: a scored number, a number whose basis was never recorded, and no
 * number at all. Folding the last two into "80%" is how an unmeasured quantity
 * came to render as a measurement.
 */
export type ConfidenceReading =
  | { kind: 'scored'; value: number }
  | { kind: 'unattributed'; value: number }
  | { kind: 'unscored' };

/**
 * Resolve a finding's confidence. An **absent** basis resolves to
 * `'unattributed'`, never `'observer'` — same stance as
 * {@link resolveSessionSource}: an object that does not claim a measurement has
 * not made one. Read confidence through this function, never off the field, so
 * the safe default is applied in exactly one place.
 */
export function resolveConfidence(
  finding: { confidence?: number | null; confidenceBasis?: ConfidenceBasis | null } | null | undefined,
): ConfidenceReading {
  const value = finding?.confidence;
  if (typeof value !== 'number' || !Number.isFinite(value)) return { kind: 'unscored' };
  return finding?.confidenceBasis === 'observer'
    ? { kind: 'scored', value }
    : { kind: 'unattributed', value };
}

/** One-line rendering of a confidence reading. Accepts a finding or a reading. */
export function confidenceLabel(
  input: ConfidenceReading | { confidence?: number | null; confidenceBasis?: ConfidenceBasis | null },
): string {
  const reading = 'kind' in input ? input : resolveConfidence(input);
  switch (reading.kind) {
    case 'scored':
      return `${reading.value}%`;
    case 'unattributed':
      return `${reading.value}% (unattributed)`;
    case 'unscored':
      return 'not scored';
  }
}

/** Longer explanation for a title/tooltip beside {@link confidenceLabel}. */
export function confidenceTitle(reading: ConfidenceReading): string {
  switch (reading.kind) {
    case 'scored':
      return `Confidence ${reading.value}% — scored by the observer that recorded this finding`;
    case 'unattributed':
      return `Confidence ${reading.value}% — basis unattributed: nothing recorded who scored this, and it may be the old 80% default`;
    case 'unscored':
      return 'Confidence not scored — nobody rated this finding, and an unscored finding is not a low-confidence one';
  }
}
