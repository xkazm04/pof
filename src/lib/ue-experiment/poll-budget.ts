/**
 * The client's poll budget for an experiment job, derived from the SERVER's own settle
 * ceiling for that same spec.
 *
 * The lab used to poll `600 × 30 s = 5 hours` for a job the runner can spend at most
 * 60 s (python probe) or 180 s (scenario) inside — the browser tab was pinned for a
 * quarter of a day on a wedged run, and the timeout said only "experiment timed out".
 * Both ceilings now come from one place: `EXPERIMENT_SETTLE_MS` below is what
 * `runner.ts` actually passes to the spawn seam, so the number the client quotes and
 * the number the server enforces cannot drift.
 *
 * Pure + free of node imports: the client bundle imports this directly.
 */
import { UI_TIMEOUTS } from '@/lib/constants';

/**
 * The settle ceilings `runner.ts` enforces when the spec does not name its own.
 * These ARE the defaults used at the spawn call sites — do not re-declare them there.
 */
export const EXPERIMENT_SETTLE_MS = {
  /** Editor-Python probe (`runPythonProbe`). */
  python: 60_000,
  /** Gameplay scenario (`runScenario` → `captureScenarioFrame`). */
  scenario: 180_000,
} as const;

/** Where the quoted ceiling came from — named in the timeout message. */
export type CeilingSource = "the spec's own settleMs" | 'the scenario default' | 'the python-probe default';

/** The minimum a budget derivation needs to know about a spec (structural, so this
 *  module never imports the runner and stays free of its node dependencies). */
export interface PollBudgetSpec {
  scenario?: unknown;
  settleMs?: number | undefined;
}

export interface PollBudget {
  /** The server's own settle ceiling for THIS spec. */
  ceilingMs: number;
  ceilingSource: CeilingSource;
  /** Stated overhead beyond the ceiling (boot + capture + judge + persist). */
  marginMs: number;
  /** Interval between status reads. */
  pollMs: number;
  /** Bound on status reads. */
  maxPolls: number;
  /** How long the client will actually wait before giving up — `pollMs × (maxPolls - 1)`
   *  (the first poll is immediate), or the derived `ceilingMs + marginMs` when neither
   *  knob was overridden. Never a number the caller did not ask for. */
  waitMs: number;
}

/** The server settle ceiling this spec will run under, and why. Pure. */
export function experimentCeiling(spec: PollBudgetSpec): { ceilingMs: number; ceilingSource: CeilingSource } {
  if (typeof spec.settleMs === 'number' && spec.settleMs > 0) {
    return { ceilingMs: spec.settleMs, ceilingSource: "the spec's own settleMs" };
  }
  return spec.scenario
    ? { ceilingMs: EXPERIMENT_SETTLE_MS.scenario, ceilingSource: 'the scenario default' }
    : { ceilingMs: EXPERIMENT_SETTLE_MS.python, ceilingSource: 'the python-probe default' };
}

/**
 * Derive the client's poll budget. `pollMs`/`maxPolls` overrides (tests, callers with a
 * reason) are honoured and the reported `waitMs` follows them, so the timeout message
 * always describes the wait that actually happened.
 */
export function experimentPollBudget(
  spec: PollBudgetSpec,
  opts: { pollMs?: number | undefined; maxPolls?: number | undefined; marginMs?: number | undefined } = {},
): PollBudget {
  const { ceilingMs, ceilingSource } = experimentCeiling(spec);
  const marginMs = opts.marginMs ?? UI_TIMEOUTS.experimentBudgetMargin;
  const pollMs = opts.pollMs ?? UI_TIMEOUTS.experimentPoll;
  const budgetMs = ceilingMs + marginMs;
  // +1 because the first poll is immediate (poll THEN sleep): N polls span (N-1) intervals.
  const derivedPolls = Math.ceil(budgetMs / Math.max(1, pollMs)) + 1;
  const maxPolls = Math.max(1, opts.maxPolls ?? derivedPolls);
  const waitMs = opts.maxPolls === undefined && opts.pollMs === undefined ? budgetMs : pollMs * (maxPolls - 1);
  return { ceilingMs, ceilingSource, marginMs, pollMs, maxPolls, waitMs };
}

/** `185000` → `3m 5s`. Small helper so every duration in the timeout message reads alike. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * The message a client-side give-up carries. It names BOTH ceilings — the one the client
 * chose to wait and the server one it was derived from — so "timed out" is a fixable
 * statement rather than a shrug.
 */
export function experimentTimeoutMessage(jobId: string, b: PollBudget): string {
  return (
    `Experiment timed out client-side after ${formatDurationMs(b.waitMs)} `
    + `(${b.maxPolls} status polls every ${formatDurationMs(b.pollMs)}). `
    + `That budget is the server's own settle ceiling of ${formatDurationMs(b.ceilingMs)} `
    + `(${b.ceilingSource}) plus a ${formatDurationMs(b.marginMs)} margin for editor boot, `
    + `capture, the visual judge and the history write. `
    + `The job (${jobId}) was still reporting "running" — it may yet finish and appear in the run history; `
    + `nothing here says the experiment failed.`
  );
}
