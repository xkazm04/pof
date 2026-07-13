/**
 * The observation spine — the ONE contract shared by the L3 spawn path
 * (`test-gate-runner/spawnExecutor`) and the L4 capture path (`ue-launch/capture`),
 * plus the deferred-reason coupling between catalog acceptance and the runner.
 *
 * It lives in `src/types/` (a neutral home) on purpose: both the `test-gate-runner`
 * and `ue-launch` feature modules depend on this spine WITHOUT depending on each
 * other — `ue-launch` stays independent of the gate-runner (its richer `GateScenario`
 * is structurally assignable to {@link ScenarioSpec} here). This satisfies the
 * context-map's promised `src/types/observation.ts` path and kills the string/shape
 * copy-paste that previously drifted between the two launch paths.
 *
 * Before this module the same shapes and builders were duplicated:
 *  - `ObsSample` was inline in spawnExecutor; the scenario spec + input in capture.ts.
 *  - `buildScenarioArgs` + the scenario-inbox JSON were copy-pasted (L3 `-nullrhi`
 *    vs L4 `-RenderOffScreen` were the only real differences).
 *  - The deferred-reason prefix was a comment-guarded string contract split across
 *    `acceptance/deferred.ts` (writer) and `test-gate-runner/parse.ts` (reader).
 */

// ── Observation samples ───────────────────────────────────────────────────────
//
// What the runtime `UScenarioController` writes to `observations.json`: one row per
// sampled tick. `droopL`/`droopR` (per-arm droop angle in degrees) are the walk-cycle
// signature — their variance across samples is the calibration-proven discriminator
// between an animating pawn and a T-posing one.

export interface ObsSample {
  t: number;
  loc_x: number;
  loc_y: number;
  loc_z: number;
  speed: number;
  droopL: number;
  droopR: number;
  anim_speed?: number;
  montage_playing?: boolean;
  health?: number;
  stamina?: number;
  mana?: number;
}

export interface Observations {
  started?: boolean;
  samples?: ObsSample[];
}

// ── Scenario spec + inputs ────────────────────────────────────────────────────
//
// The capture-facing subset of a behavioural scenario. The gate-runner's richer
// `GateScenario` (which adds `assert`) is structurally assignable to `ScenarioSpec`,
// so a gate scenario can be passed straight into either launch path.

/** One timed input in a behavioural scenario. `key` = a real simulated key through the
 *  IMC (e.g. "W"/"SpaceBar"); else `action` (path) + `value` injects the post-modifier
 *  vector directly; else a non-input `event` (+`eventArg`) fired at `start`. */
export interface ScenarioInput {
  key?: string;
  action?: string;
  value?: [number, number];
  event?: string;
  eventArg?: string;
  start: number;
  duration: number;
}

/** The subset of a scenario the launch paths need. A `GateScenario` is assignable. */
export interface ScenarioSpec {
  map?: string;
  totalSeconds?: number;
  numSamples?: number;
  settle?: number;
  inputs?: ScenarioInput[];
  /** Destroy AI-possessed pawns at scenario start so combat can't interfere with the
   *  observed behavior (e.g. isolate locomotion — enemies otherwise stagger the player). */
  disableAI?: boolean;
}

/** Serialize scenario inputs into the snake_case inbox shape the UE controller reads.
 *  Empty/absent optional fields are omitted (not emitted as null). Pure. */
export function mapScenarioInputs(inputs: readonly ScenarioInput[]): Array<Record<string, unknown>> {
  return inputs.map((i) => ({
    ...(i.key ? { key: i.key } : {}),
    ...(i.action ? { action: i.action } : {}),
    ...(i.value ? { value: i.value } : {}),
    ...(i.event ? { event: i.event } : {}),
    ...(i.eventArg ? { event_arg: i.eventArg } : {}),
    start: i.start,
    duration: i.duration,
  }));
}

// ── The scenario inbox JSON (the ONE writer for both launch paths) ─────────────

export interface ScenarioInboxOptions {
  totalSeconds?: number;
  numSamples?: number;
  settle?: number;
  /** L3 only: force-play an anim asset at Begin (single-node) — isolates mesh vs ABP. */
  playAnim?: string;
  disableAI?: boolean;
  inputs?: readonly ScenarioInput[];
}

/**
 * Build the scenario-inbox JSON string written to `out_dir/scenario.json` (L3) or
 * `out_dir/inbox.json` (L4). Defaults (`total_seconds=3`, `num_samples=1`,
 * `settle=1.5`) serve the capture-only path; the spawn path passes explicit values
 * (so its own `settle` default of `1.0` is applied by the caller before this runs).
 * `play_anim` / `disable_ai` are emitted only when set. Pure.
 */
export function buildScenarioInbox(outDir: string, opts: ScenarioInboxOptions = {}): string {
  return JSON.stringify({
    out_dir: outDir,
    total_seconds: opts.totalSeconds ?? 3,
    num_samples: opts.numSamples ?? 1,
    settle: opts.settle ?? 1.5,
    ...(opts.playAnim ? { play_anim: opts.playAnim } : {}),
    ...(opts.disableAI ? { disable_ai: true } : {}),
    inputs: mapScenarioInputs(opts.inputs ?? []),
  }, null, 2);
}

// ── The scenario launch args (the ONE builder for both launch paths) ───────────
//
// Both paths open the map in `-game`, arm the controller via `-PoFScenario`, and use a
// fixed 1/60s timestep (`-benchmark -fps=60`) so a headless run is deterministic and the
// Motion Quality Probe's acceleration metric (Δvel/dt) doesn't explode on uncapped-fps
// numerical noise. The ONLY difference is the render mode:
//  - `nullrhi`  (L3): CPU-only pose/movement metrics + `-abslog` (frame capture is L4).
//  - `offscreen` (L4): `-RenderOffScreen` at an explicit resolution so a real frame writes.

export type ScenarioRender =
  | { mode: 'nullrhi'; abslog: string }
  | { mode: 'offscreen'; resX: number; resY: number };

export interface ScenarioLaunchArgsOptions {
  uproject: string;
  map: string;
  /** The written inbox path passed to `-PoFScenario`. */
  scenarioPath: string;
  render: ScenarioRender;
}

/** Build the `UnrealEditor` args for a `-game -PoFScenario` scenario run. Pure. */
export function buildScenarioLaunchArgs(o: ScenarioLaunchArgsOptions): string[] {
  const head = [o.uproject, o.map, '-game', `-PoFScenario=${o.scenarioPath}`];
  const timing = ['-benchmark', '-fps=60', '-unattended', '-nopause', '-nosplash'];
  if (o.render.mode === 'nullrhi') {
    return [...head, '-nullrhi', ...timing, '-log', `-abslog=${o.render.abslog}`];
  }
  return [...head, '-RenderOffScreen', `-ResX=${o.render.resX}`, `-ResY=${o.render.resY}`, ...timing, '-NoLiveCoding'];
}

// ── Deferred-reason coupling (single source for deferred.ts ↔ parse.ts) ────────
//
// `runtimeDeferred(testName)` (acceptance/deferred.ts) writes a reason that embeds the
// UE test name; the runner (`collectDeferred` via `parse.ts`) recovers it. Both ends now
// go through this pair so the prefix can never drift.

export const RUNTIME_DEFERRED_PREFIX = 'live-UE runner not yet run:';

/** The deferred reason an L3 runtime check writes so the runner can recover `testName`. */
export function buildRuntimeDeferredReason(testName: string): string {
  return `${RUNTIME_DEFERRED_PREFIX} ${testName}`;
}

/** Recover the UE test name from a {@link buildRuntimeDeferredReason} reason, else null. */
export function parseRuntimeDeferredTestName(reason?: string): string | null {
  if (!reason) return null;
  const i = reason.indexOf(RUNTIME_DEFERRED_PREFIX);
  if (i === -1) return null;
  const name = reason.slice(i + RUNTIME_DEFERRED_PREFIX.length).trim();
  return name.length ? name : null;
}
