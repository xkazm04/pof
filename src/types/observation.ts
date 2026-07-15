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
  /**
   * True when the requested gameplay-ability tag was actually FOUND on the pawn's ASC before
   * activation, false when the tag resolved to nothing (a wrong/blind-PascalCased tag). Lets the
   * `ability-activated` verdict tell "the ability tag doesn't exist" apart from "the ability ran
   * but produced no observable effect" — two very different failures that otherwise both read as
   * "no montage and no resource". Additive to the spine; absent in older UE emissions (the verdict
   * degrades to the effect-only check). The UE-side `UScenarioController` must set this on the
   * `activate_ability` path for the loud-mismatch verdict to fire — see L3-L4-RUNNER.md.
   */
  ability_found?: boolean;
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

// ── Evidence-carrying verdicts ─────────────────────────────────────────────────
//
// A gate flip used to persist only status + a detail string; the PROOF (which abslog
// markers matched, the observation stats, the captured frame, the judge text) evaporated.
// `GateEvidence` is the structured, SIZE-BOUNDED proof a verdict carries and `drainOne`
// merges into the artifact's `data.evidence`, so the judge fleet and /status can audit a
// verdict directly instead of re-running the gate.
//
// SIZE BOUND (documented, enforced by the helpers below): sample arrays are down-sampled to
// at most `EVIDENCE_MAX_SAMPLES` rows (stats, not raw streams, carry the aggregate), and any
// free-form judge text is truncated to `EVIDENCE_MAX_TEXT` chars — the persisted evidence is
// bounded regardless of how many samples a scenario emitted or how verbose a judge was.

export const EVIDENCE_MAX_SAMPLES = 8;
export const EVIDENCE_MAX_TEXT = 500;

export type GateEvidenceKind = 'scenario' | 'automation' | 'bridge' | 'visual';

export interface GateEvidence {
  kind: GateEvidenceKind;
  /** ISO timestamp the verdict was produced. */
  at: string;
  /** Marker lines that decided the verdict: abslog markers matched (automation/spawn) or the
   *  bridge's automation-result summary. */
  markers?: string[];
  /** Down-sampled observation rows (scenario) — bounded to {@link EVIDENCE_MAX_SAMPLES}. */
  samples?: ObsSample[];
  /** Derived numeric stats (e.g. `swingDeg`, `distance`, `sampleCount`) — the aggregate that
   *  survives even when raw samples are dropped. */
  stats?: Record<string, number>;
  /** The captured frame this verdict was judged from (visual). */
  screenshotPath?: string;
  /** The judge's verdict text (visual), truncated to {@link EVIDENCE_MAX_TEXT}. */
  judgeText?: string;
}

/** Down-sample to at most `max` evenly-spaced rows (always keeping the first + last). Pure. */
export function boundSamples(samples: readonly ObsSample[], max = EVIDENCE_MAX_SAMPLES): ObsSample[] {
  if (max < 1) return [];
  if (samples.length <= max) return [...samples];
  if (max === 1) return [samples[samples.length - 1]];
  const out: ObsSample[] = [];
  const step = (samples.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(samples[Math.round(i * step)]);
  return out;
}

/** Truncate free-form judge text to the evidence cap (adds an ellipsis when clipped). Pure. */
export function boundJudgeText(text: string, max = EVIDENCE_MAX_TEXT): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** One-line human summary of evidence for the notification payload / webhook. Pure. */
export function summarizeEvidence(e?: GateEvidence): string | undefined {
  if (!e) return undefined;
  const bits: string[] = [];
  if (e.stats) bits.push(Object.entries(e.stats).map(([k, v]) => `${k}=${Number.isInteger(v) ? v : v.toFixed(1)}`).join(' '));
  if (e.markers?.length) bits.push(e.markers.join('; '));
  if (e.samples?.length) bits.push(`${e.samples.length} samples`);
  if (e.screenshotPath) bits.push(`frame ${e.screenshotPath}`);
  if (e.judgeText) bits.push(`judge: ${e.judgeText}`);
  return `[${e.kind}] ${bits.filter(Boolean).join(' · ')}`.trim();
}
