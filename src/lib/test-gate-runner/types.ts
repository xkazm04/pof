/**
 * Test-gate runner — the executor seam that drains `deferred` L3/L4 pipeline
 * artifacts into real pass/fail verdicts. See docs/catalog/L3-L4-RUNNER.md.
 */

export type GateTier = 'L3' | 'L4';

/** One timed input in a behavioural scenario. `key` = real simulated key through the
 *  IMC (e.g. "W"/"SpaceBar"); else `action` (path) + `value` injects the post-modifier
 *  vector directly. */
export interface GateScenarioInput {
  key?: string;
  action?: string;
  value?: [number, number];
  start: number;
  duration: number;
}

/** An assertion over the observed result of a scenario. All must hold to pass.
 *  Discriminators are the calibration-proven ones (arm-droop variance = animation,
 *  displacement = movement) — not symbolic "test returned PASS". */
export type GateAssertion =
  | { kind: 'animated'; minSwingDeg?: number } // arm-droop varies across samples (walk cycle); default ≥10°
  | { kind: 'moved'; minDist?: number }        // pawn displaced ≥ minDist (2D); default ≥50
  | { kind: 'static'; maxSwingDeg?: number };  // arm-droop ~constant (T-pose / not animating); default ≤5°

/** A behavioural L3 scenario: drive timed inputs in a real game loop, then assert on
 *  the *observed* effect (the harness `observation.run_scenario` contract). */
export interface GateScenario {
  map: string;
  totalSeconds: number;
  numSamples: number;
  settle?: number;
  /** Optional: force-play an anim asset at Begin (single-node) — isolates mesh vs ABP. */
  playAnim?: string;
  inputs: GateScenarioInput[];
  assert: GateAssertion[];
}

/** One deferred Test Gate to run, derived from a `pipeline_artifacts` row. */
export interface GateJob {
  catalogId: string;
  entityId: string;
  step: string;
  tier: GateTier;
  /** L3 only — the UE automation test/filter, recovered from the deferred reason. */
  testName?: string;
  /** L3 behavioural — a scenario to drive + observe (faithful gate). Takes precedence
   *  over `testName` in the spawn executor. */
  scenario?: GateScenario;
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
