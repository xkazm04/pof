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
  /** Non-input event at `start`: 'activate_ability' + eventArg=<gameplay tag> (e.g.
   *  'Ability.Fireball') activates it directly on the pawn's ASC — bypasses Boolean-key
   *  input fidelity gaps to test the ability's *effect*. */
  event?: string;
  eventArg?: string;
  start: number;
  duration: number;
}

/** An assertion over the observed result of a scenario. All must hold to pass.
 *  Discriminators are the calibration-proven ones (arm-droop variance = animation,
 *  displacement = movement) — not symbolic "test returned PASS". */
export type AttrName = 'health' | 'stamina' | 'mana';

export type GateAssertion =
  | { kind: 'animated'; minSwingDeg?: number } // arm-droop varies across samples (walk cycle); default ≥10°
  | { kind: 'moved'; minDist?: number }        // pawn displaced ≥ minDist (2D); default ≥50
  | { kind: 'static'; maxSwingDeg?: number }   // arm-droop ~constant (T-pose / not animating); default ≤5°
  | { kind: 'montage-playing' }                // a montage played in ≥1 sample (attack/cast/dodge fired)
  | { kind: 'attribute-drop'; name: AttrName; minDelta?: number } // resource consumed (max−min ≥ minDelta; default 1)
  | { kind: 'ability-activated' };             // montage played OR any resource dropped (the ability committed)

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
  /**
   * L4: the rendered frame this verdict was judged from. Surfaced as a first-class field so
   * the loop CLOSES — the agent is handed a frame to READ with its own eyes, not trusted to
   * remember to look. The automated (Gemini) judge catches only gross errors (T-pose, black
   * scene, missing humanoid); it will pass a mannequin standing in a non-attack or miss debug
   * cruft. Reviewing this PNG is what catches those.
   */
  screenshot?: string;
  /** Executor-specific payload (logs, assertion results) — for debugging. */
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
  /** Rendered frames produced by L4 gates this drain — READ these to verify the result by eye. */
  screenshots: string[];
  results: DrainResult[];
}
