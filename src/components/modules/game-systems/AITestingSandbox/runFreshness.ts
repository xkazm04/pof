import type { TestScenario } from '@/types/ai-testing';

// ── Run-result freshness (honest run state) ──
//
// A scenario's `status` pill is the outcome of the LAST RUN, but the scenario
// keeps being edited afterwards — rewrite the stimuli of a passing scenario and
// the pill still reads "Passed". That green is a lie: nothing has re-verified
// the scenario since the edit.
//
// This module derives, purely from the scenario row, whether the stored result
// still describes the current definition. It is display-only: it never rewrites
// `status`, and the DB stays the single source of truth for the outcome itself.

/**
 * Slack between `lastRunAt` and `updatedAt` that still counts as "the run wrote
 * this row". The run write-back (`record-run-results`) sets `last_run_at` from a
 * JS ISO stamp while `updated_at` comes from SQLite's `datetime('now')` — two
 * clocks, whole-second truncation, and the status flip lands a moment after the
 * stamp. A minute of tolerance absorbs that without ever crying wolf; the cost
 * is that an edit made within a minute of a run reads as fresh for that minute.
 */
export const RUN_STALENESS_TOLERANCE_MS = 60_000;

export type RunFreshnessState =
  /** No run has ever been recorded for this scenario. */
  | 'never-run'
  /** A run is in flight — the stored result is deliberately provisional. */
  | 'running'
  /** The scenario was edited after its last run, so the result is out of date. */
  | 'stale'
  /** The stored result describes the scenario as it stands. */
  | 'current';

export interface RunFreshness {
  state: RunFreshnessState;
  /** Epoch ms of the last run, or `null` when never run / unparseable. */
  ranAtMs: number | null;
  /** How far the last edit trails the last run, in ms (0 when not stale). */
  driftMs: number;
}

/**
 * Parse a timestamp as written by this app's DB layer.
 *
 * Two shapes reach the client: JS ISO strings (`2026-07-24T09:12:00.000Z`,
 * written by the API for `lastRunAt`) and SQLite's `datetime('now')` output
 * (`2026-07-24 09:12:00`, written for `updated_at`). The latter is UTC but
 * carries no zone, and `new Date()` would read it as LOCAL time — a silent
 * multi-hour skew that would make every row look stale (or never stale) purely
 * by timezone. Normalise it to UTC before parsing.
 */
export function parseDbTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasZone ? value : `${value.replace(' ', 'T')}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Derive whether a scenario's stored run result still describes it. */
export function getRunFreshness(scenario: TestScenario): RunFreshness {
  const ranAtMs = parseDbTimestamp(scenario.lastRunAt);
  if (scenario.status === 'running') return { state: 'running', ranAtMs, driftMs: 0 };
  if (ranAtMs === null) return { state: 'never-run', ranAtMs: null, driftMs: 0 };

  const updatedMs = parseDbTimestamp(scenario.updatedAt);
  const drift = updatedMs === null ? 0 : updatedMs - ranAtMs;
  return drift > RUN_STALENESS_TOLERANCE_MS
    ? { state: 'stale', ranAtMs, driftMs: drift }
    : { state: 'current', ranAtMs, driftMs: 0 };
}

/**
 * One sentence explaining what the stored result is worth — used as the
 * expanded-card note and as the screen-reader text behind the collapsed chip.
 */
export function describeRunFreshness(state: RunFreshnessState): string {
  switch (state) {
    case 'never-run':
      return 'Never run — this status is the authored state, not a result.';
    case 'running':
      return 'Run in progress — the status below is from the previous run.';
    case 'stale':
      return 'Edited since the last run — this result describes an older version of the scenario. Re-run to re-verify.';
    case 'current':
      return 'Result matches the current scenario definition.';
  }
}
