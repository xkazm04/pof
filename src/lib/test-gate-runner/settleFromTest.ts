/**
 * Close the loop for an agent that ran a UE test ITSELF.
 *
 * `pof_ue_run_tests` / `pof_ue_test_results` let an agent run the exact automation test a
 * deferred L3 gate is waiting on — and until now nothing wrote back, so the gate stayed
 * `deferred` and only a drain could settle it. This module settles those gates from the raw
 * plugin payload the agent already has, reusing the runner's existing per-test truth end to end:
 *
 * - **which gates want this test** — `collectDeferred` + `parseTestName` (the same recovery of
 *   the test name from the deferred reason the drain uses; a synthetic fixture entity is still
 *   excluded from a broad sweep unless named explicitly);
 * - **what the payload means** — `automationOutcome` (the bridge executor's own mapper, so
 *   `not_found` is the same honest `deferred` "planned, not registered in UE", and a
 *   non-terminal payload settles NOTHING rather than inventing a verdict);
 * - **how a verdict is persisted** — `applyVerdict` (the drain's single write-back path:
 *   read-merge-write, evidence merge, `gate.verdict.changed` announcement).
 *
 * It does NOT run anything and never touches UE. The caller (the route) is responsible for
 * holding the drain lease so a concurrent drain is not clobbered.
 */
import { automationOutcome } from './bridgeExecutor';
import { applyVerdict, collectDeferred, type DrainFilter } from './drain';
import type { GateJob, GateVerdict } from './types';

/** One gate this settle touched (or explicitly did not), with the reason either way. */
export interface SettledGate {
  catalogId: string;
  entityId: string;
  step: string;
  /** The verdict written, or null when nothing was written. */
  status: GateVerdict['status'] | null;
  reason: string;
}

export interface SettleOutcome {
  /** Deferred gates whose recovered test name matched `testName`. */
  matched: number;
  /** Gates actually written (a terminal verdict, incl. an updated `deferred` reason). */
  settled: number;
  /** deferred → pass / → fail flips (a subset of `settled`). */
  passed: number;
  failed: number;
  /** Settled to (or left at) `deferred` — the test is planned but not registered in UE. */
  deferred: number;
  gates: SettledGate[];
  /** Human sentence for the agent — always says what happened, including "nothing". */
  note: string;
}

/** The gates (L3, deferred) whose recovered test name is exactly `testName`, within `filter`. */
export function gatesWaitingOnTest(testName: string, filter?: DrainFilter): GateJob[] {
  const wanted = testName.trim();
  return collectDeferred({ ...filter, tier: 'L3' }).filter((j) => j.testName === wanted);
}

/**
 * Settle every deferred gate waiting on `testName` from one raw plugin payload
 * (the body of `POST /pof/test/run-automation` or `GET /pof/test/results`).
 *
 * - no matching gate → nothing is written and the note SAYS so (the agent is told its run
 *   settled nothing, rather than being left to assume it did);
 * - a non-terminal payload (accepted/running/not recorded yet) → nothing is written, and the
 *   note names the pending state — a gate is never flipped on a run that has not finished.
 */
export function settleGatesFromTestRun(
  testName: string,
  payload: unknown,
  filter?: DrainFilter,
): SettleOutcome {
  const jobs = gatesWaitingOnTest(testName, filter);
  const base: SettleOutcome = { matched: jobs.length, settled: 0, passed: 0, failed: 0, deferred: 0, gates: [], note: '' };

  if (jobs.length === 0) {
    return { ...base, note: `No deferred L3 gate is waiting on "${testName}" in this scope — nothing was changed.` };
  }

  const outcome = automationOutcome(testName, payload);
  if (outcome.kind === 'pending') {
    return {
      ...base,
      gates: jobs.map((j) => ({
        catalogId: j.catalogId, entityId: j.entityId, step: j.step,
        status: null, reason: `run not terminal (${outcome.detail}) — gate left deferred`,
      })),
      note: `The test run has not produced a terminal result yet (${outcome.detail}). ${jobs.length} matching gate(s) left deferred — poll pof_ue_test_results and settle again.`,
    };
  }

  const verdict = outcome.verdict;
  const gates: SettledGate[] = [];
  for (const job of jobs) {
    applyVerdict(job, verdict);
    gates.push({ catalogId: job.catalogId, entityId: job.entityId, step: job.step, status: verdict.status, reason: verdict.detail });
  }
  const n = jobs.length;
  return {
    matched: n,
    settled: n,
    passed: verdict.status === 'pass' ? n : 0,
    failed: verdict.status === 'fail' ? n : 0,
    deferred: verdict.status === 'deferred' ? n : 0,
    gates,
    note: `Settled ${n} gate(s) waiting on "${testName}" to ${verdict.status}: ${verdict.detail}`,
  };
}
