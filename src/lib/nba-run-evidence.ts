/**
 * Recorded-run evidence for a module's "success odds".
 *
 * The Next Best Action card used to claim "50% past success on similar work" on
 * a project where nothing had ever run: `computeNBA` fell back to a hard-coded
 * `0.5` whenever the module had no history, and the never-written
 * `moduleStore.moduleHistory` slice meant that fallback was the ONLY path in
 * production (`addHistoryEntry` has no production caller; the real DB's
 * `project_progress.history_json` is `{}`).
 *
 * Every module CLI dispatch, meanwhile, already records its outcome to SQLite
 * (`useModuleCLI` → `recordSessionOutcome` → `session_analytics`). This module
 * is the pure projection of those rows into the one number the card may quote —
 * and, crucially, the `null` that means *nothing has run yet*, so the UI can say
 * so instead of printing a manufactured percentage.
 *
 * DOM-free and store-free so both the engine and the fetching hooks can share it.
 */

/** What the recorded runs of ONE module say about its success odds. */
export interface ModuleRunEvidence {
  /** How many runs are recorded for this module. */
  runs: number;
  /** How many of those runs succeeded. */
  successes: number;
  /**
   * `successes / runs`, or `null` when nothing has ever run.
   *
   * `null` is load-bearing: it is NOT rendered as 0% and never substituted with
   * a neutral constant. A factor with no evidence scores no points.
   */
  rate: number | null;
}

/** The evidence of a module that has never run. */
export const NO_RUN_EVIDENCE: ModuleRunEvidence = Object.freeze({
  runs: 0,
  successes: 0,
  rate: null,
});

/**
 * Build evidence from a run/success count pair.
 *
 * Defensive because both numbers arrive from the network (`session_analytics`
 * aggregates): anything non-finite, negative, or claiming more successes than
 * runs is treated as no evidence rather than as a rate above 1.
 */
export function makeRunEvidence(runs: number, successes: number): ModuleRunEvidence {
  if (!Number.isFinite(runs) || !Number.isFinite(successes)) return NO_RUN_EVIDENCE;
  const total = Math.max(0, Math.floor(runs));
  if (total === 0) return NO_RUN_EVIDENCE;
  const ok = Math.min(total, Math.max(0, Math.floor(successes)));
  return { runs: total, successes: ok, rate: ok / total };
}

/** Summarise a list of recorded runs (any row exposing a boolean `success`). */
export function summarizeRuns(
  rows: readonly { success: boolean }[] | null | undefined,
): ModuleRunEvidence {
  if (!rows || rows.length === 0) return NO_RUN_EVIDENCE;
  let successes = 0;
  for (const r of rows) if (r.success) successes += 1;
  return makeRunEvidence(rows.length, successes);
}

/**
 * The plain-language sentence for a module's odds — always naming the sample
 * size, and naming its ABSENCE when there is none. This is the only sentence
 * the UI is allowed to use for the success factor; a bare percentage hides
 * exactly the thing that made the old copy a lie.
 */
export function describeRunEvidence(evidence: ModuleRunEvidence): string {
  if (evidence.rate === null || evidence.runs === 0) {
    return 'No recorded runs for this module yet — success odds not scored';
  }
  const runWord = evidence.runs === 1 ? 'run' : 'runs';
  return `${evidence.successes} of ${evidence.runs} past ${runWord} succeeded`;
}
