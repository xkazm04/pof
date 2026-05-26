/**
 * Test-gate runner — the executor seam that drains `deferred` L3/L4 pipeline
 * artifacts into real pass/fail verdicts. See docs/catalog/L3-L4-RUNNER.md.
 */

export type GateTier = 'L3' | 'L4';

/** One deferred Test Gate to run, derived from a `pipeline_artifacts` row. */
export interface GateJob {
  catalogId: string;
  entityId: string;
  step: string;
  tier: GateTier;
  /** L3 only — the UE automation test/filter, recovered from the deferred reason. */
  testName?: string;
  /** The original deferred reason (for context / skip messages). */
  reason?: string;
}

/** The outcome of running a gate. */
export interface GateVerdict {
  status: 'pass' | 'fail';
  /** Human-readable; becomes the artifact's new `reason`. */
  detail: string;
  /** Executor-specific payload (logs, assertion results, screenshot path) — for debugging. */
  raw?: unknown;
}

/**
 * Runs gates of a single tier. The seam: the bridge (running editor), spawn
 * (headless UnrealEditor-Cmd), and visual-bridge (RHI + Gemini) executors all
 * satisfy this, so the run mode is chosen at call time, not baked in.
 */
export interface GateExecutor {
  readonly id: string;
  readonly tier: GateTier;
  /** Can this executor run right now? (e.g. bridge reachable, spawn enabled). */
  available(): Promise<boolean>;
  run(job: GateJob): Promise<GateVerdict>;
}

export interface DrainResult {
  job: GateJob;
  verdict?: GateVerdict;
  /** Set instead of `verdict` when the job was not run (stays deferred). */
  skipped?: string;
}

export interface DrainSummary {
  ran: number;
  passed: number;
  failed: number;
  skipped: number;
  results: DrainResult[];
}
