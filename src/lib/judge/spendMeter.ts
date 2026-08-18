/**
 * Judge-fleet spend metering (pure parsing + policy glue).
 *
 * A judge fleet run is the most expensive thing this app does — one Opus/high CLI spawn per
 * (entity x step) x median draws, and `--all` sweeps every catalog in `step-facts.json`. Until
 * this module existed those spawns were made by `scripts/judge-run.ts` with a raw
 * `spawn('claude', …)`, so they never reached {@link recordSpend}: the Spend tab's total was
 * structurally incomplete whenever the fleet had run, and a configured budget could not refuse
 * a run it could not see.
 *
 * This is the seam that makes a judge spawn meterable. It is deliberately pure — the script
 * owns the process spawn and the DB writes — so the parsing and the budget decision are
 * unit-testable without a CLI or a database.
 */

import type { DeliverableClass } from './dimensions';
import type { TaskTypeEstimate } from '@/types/cli-spend';
import { evaluatePreflight, type PreflightBudget, type PreflightVerdict } from '@/lib/cli-spend/preflight';
import { formatUsd } from '@/lib/cli-spend/format';

/**
 * The spend task types a judge spawn is recorded under. These are the SAME vocabulary the
 * pre-flight guardrail and the Spend dashboard already speak (`EXPENSIVE_TASK_TYPES`), so a
 * fleet run shows up beside every other CLI cost instead of in a private ledger.
 */
export type JudgeTaskType = 'judge-content' | 'judge-visual';

/** Which spend task type a deliverable class's judge spawn is billed to. */
export function judgeTaskType(cls: DeliverableClass): JudgeTaskType {
  return cls === 'text-config' ? 'judge-content' : 'judge-visual';
}

/** The spend module every judge spawn is attributed to (the Spend tab's per-module rollup). */
export const JUDGE_SPEND_MODULE = 'judge';

/**
 * One CLI run's text output plus its metered cost. `costKnown` is the honesty flag: when the
 * CLI's JSON envelope could not be parsed we still record the run (a spawn happened and it cost
 * something) but we must not claim to know the amount — a fabricated 0 that looked like a real
 * measurement is exactly the invisibility this module exists to remove.
 */
export interface CliRunMetrics {
  /** The assistant's final text — what the judge parser reads. */
  text: string;
  costUsd: number;
  costKnown: boolean;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
  sessionKey: string | null;
  isError: boolean;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Slice out the outermost JSON object in a stdout blob (the CLI may prefix warnings). */
function jsonSlice(stdout: string): string | null {
  const a = stdout.indexOf('{');
  const b = stdout.lastIndexOf('}');
  return a >= 0 && b > a ? stdout.slice(a, b + 1) : null;
}

/**
 * Parse the stdout of `claude -p --output-format json` into text + metered usage.
 *
 * The judge harness previously ran `--output-format text`, which carries no cost or usage at
 * all. `json` returns the same final text under `result` plus `total_cost_usd` / `usage` /
 * `duration_ms`, so switching the format is what makes the run meterable — it does not change
 * the prompt, the model, or anything the judge decides.
 *
 * Never throws: unparseable stdout degrades to the raw text with `costKnown: false`.
 */
export function parseCliJsonRun(stdout: string): CliRunMetrics {
  const base: CliRunMetrics = {
    text: stdout,
    costUsd: 0,
    costKnown: false,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    durationMs: 0,
    sessionKey: null,
    isError: false,
  };
  const slice = jsonSlice(stdout);
  if (!slice) return base;
  let o: Record<string, unknown>;
  try {
    const parsed = JSON.parse(slice) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base;
    o = parsed as Record<string, unknown>;
  } catch {
    return base;
  }
  const usage = (o.usage ?? {}) as Record<string, unknown>;
  const hasCost = typeof o.total_cost_usd === 'number' && Number.isFinite(o.total_cost_usd);
  return {
    text: typeof o.result === 'string' ? o.result : stdout,
    costUsd: num(o.total_cost_usd),
    costKnown: hasCost,
    tokensIn: num(usage.input_tokens),
    tokensOut: num(usage.output_tokens),
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheCreationTokens: num(usage.cache_creation_input_tokens),
    durationMs: num(o.duration_ms),
    sessionKey: typeof o.session_id === 'string' ? o.session_id : null,
    isError: o.is_error === true || o.subtype === 'error_during_execution',
  };
}

/**
 * Build the `recordSpend` input for one judge spawn. Pure, so the metering contract (module,
 * task type, per-run label, status) is asserted in a test without spawning a CLI — the script
 * only has to hand the result to `recordSpend`.
 *
 * `label` names the exact unit of work (`catalog::step [entity] draw i/N`) so a fleet run's cost
 * is attributable per run instead of arriving as one opaque total. A spawn whose cost the CLI
 * did not report is labelled as such rather than presented as a measured $0.00.
 */
export function judgeSpendRecord(taskType: JudgeTaskType, label: string, m: CliRunMetrics) {
  return {
    moduleId: JUDGE_SPEND_MODULE,
    taskType,
    taskLabel: (m.costKnown ? label : `${label} (cost unreported by CLI)`).slice(0, 300),
    sessionKey: m.sessionKey,
    costUsd: m.costUsd,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    cacheReadTokens: m.cacheReadTokens,
    cacheCreationTokens: m.cacheCreationTokens,
    durationMs: m.durationMs,
    success: !m.isError,
    status: (m.isError ? 'failed' : 'completed') as 'completed' | 'failed',
  };
}

/** The refusal decision for a fleet run. */
export interface JudgeBudgetGate {
  /** True when the run must NOT start (or must stop) unless explicitly forced. */
  refuse: boolean;
  /** Human-readable justification — printed by the harness so a refusal is never silent. */
  reasons: string[];
  verdict: PreflightVerdict;
}

/**
 * Decide whether a judge fleet run may proceed, through the SAME `evaluatePreflight` engine the
 * interactive terminal uses. A headless harness has nobody to answer a confirm dialog, so the
 * guardrail's `warn` becomes a hard refusal here (overridable with an explicit force flag by the
 * operator, never by default).
 */
export function judgeBudgetGate(input: {
  taskType: JudgeTaskType;
  estimate?: TaskTypeEstimate | null;
  budget?: PreflightBudget | null;
}): JudgeBudgetGate {
  const verdict = evaluatePreflight(input);
  return { refuse: verdict.warn, reasons: verdict.reasons, verdict };
}

// ── What a run actually spent, against what it was allowed to ────────────────

/** A running total of judge spend. The harness keeps one; it is also snapshotted at a stop. */
export interface JudgeSpendTotals {
  costUsd: number;
  spawns: number;
  /** Spawns whose CLI envelope carried no cost. Unmeasured — NOT free. */
  unknownCost: number;
}

/**
 * The headroom a run starts with: the smaller of the configured daily/monthly remainders, or
 * null when no budget is configured (no ceiling exists to hold, and saying "$0 ceiling" would
 * be a lie). A negative remainder is a ceiling of 0 — already over.
 */
export function judgeSpendCeiling(budget?: PreflightBudget | null): number | null {
  if (!budget) return null;
  const remainders = [budget.dailyRemainingUsd, budget.monthlyRemainingUsd].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (!remainders.length) return null;
  return Math.max(0, Math.min(...remainders));
}

/** The truthful end-of-run spend statement. */
export interface JudgeRunSpendReport {
  costUsd: number;
  spawns: number;
  unknownCost: number;
  ceilingUsd: number | null;
  /** Spend recorded AFTER the budget gate tripped — exactly what the ceiling failed to prevent. */
  overshootUsd: number;
  overshootSpawns: number;
  /** Draws that were already in flight at the stop and were drained rather than killed. */
  drainedAtStop: number;
  /** True when the recorded spend passed the headroom the run started with. */
  exceededCeiling: boolean;
  /** True when the total is a FLOOR because some spawns reported no cost. */
  totalIsFloor: boolean;
  /** Printable lines — the harness prints these verbatim, so the claim can't drift from the math. */
  lines: string[];
}

/**
 * Turn a run's totals into a statement that cannot imply the ceiling held when it did not.
 *
 * Three honesty rules, all pure and testable here rather than interpolated into a console.log:
 *  1. Spend is stated AGAINST the ceiling the run started with, or explicitly as "no ceiling
 *     configured" — never as a bare number that reads as within budget.
 *  2. Any spend recorded after the stop tripped is reported as OVERSHOOT, with the number of
 *     drained in-flight draws that produced it (the drain policy is `runDrainPool`'s).
 *  3. Spawns with `costKnown: false` make the total a FLOOR, and the line says so — an
 *     unmeasured spawn is not a free one.
 */
export function summarizeJudgeSpend(input: {
  totals: JudgeSpendTotals;
  ceilingUsd?: number | null;
  /** Totals captured at the instant the gate tripped; null/absent when it never did. */
  atStop?: JudgeSpendTotals | null;
  drainedAtStop?: number;
  stopReason?: string | null;
}): JudgeRunSpendReport {
  const { costUsd, spawns, unknownCost } = input.totals;
  const ceilingUsd = input.ceilingUsd ?? null;
  const atStop = input.atStop ?? null;
  const overshootUsd = atStop ? Math.max(0, costUsd - atStop.costUsd) : 0;
  const overshootSpawns = atStop ? Math.max(0, spawns - atStop.spawns) : 0;
  const exceededCeiling = ceilingUsd !== null && costUsd > ceilingUsd;
  const totalIsFloor = unknownCost > 0;

  const lines: string[] = [];
  lines.push(
    `spend ${formatUsd(costUsd)} over ${spawns} spawn(s)` +
      (ceilingUsd === null
        ? ' — no budget configured, so this run had no ceiling to hold'
        : ` of a ${formatUsd(ceilingUsd)} ceiling (the budget headroom at run start)`),
  );
  if (exceededCeiling) {
    lines.push(`CEILING EXCEEDED by ${formatUsd(costUsd - ceilingUsd)} — the configured budget did not hold.`);
  }
  if (atStop) {
    lines.push(
      `budget stop tripped at ${formatUsd(atStop.costUsd)}; ${formatUsd(overshootUsd)} was spent AFTER it across ` +
        `${overshootSpawns} spawn(s)` +
        (input.drainedAtStop
          ? ` — ${input.drainedAtStop} draw(s) were already in flight and were drained, not killed (a killed draw still costs but reports nothing).`
          : ' (no draw was in flight when it tripped).'),
    );
    if (input.stopReason) lines.push(`stop reason: ${input.stopReason}`);
  }
  if (totalIsFloor) {
    lines.push(
      `${unknownCost} spawn(s) reported no cost — unmeasured, not free, so ${formatUsd(costUsd)} is a FLOOR on what this run spent.`,
    );
  }
  return { costUsd, spawns, unknownCost, ceilingUsd, overshootUsd, overshootSpawns, drainedAtStop: input.drainedAtStop ?? 0, exceededCeiling, totalIsFloor, lines };
}
