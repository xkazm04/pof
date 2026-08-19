/**
 * UE Experiment runner — execute an ad-hoc concept (Python) on the connected
 * UE 5.8 project headless, capture the observed output (screenshot + log markers
 * + optional Gemini visual verdict), and return it. The "theory → output" engine
 * behind the Experiment Lab.
 *
 * Thin orchestration over `@/lib/ue-launch` (buildLaunchArgs / buildPythonExecFile
 * / resolveEditorBinary / extractLogMarker) — no new launch/verdict abstractions.
 * Pure cores (probe/args/parse) are unit-tested; the spawn + verify are injectable
 * seams so the orchestration is tested without a real editor.
 */
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLaunchArgs, buildPythonExecFile, resolveEditorBinaryDetailed, editorNotFoundMessage, captureScenarioFrame, type EnvLike, type CaptureScenarioInput } from '@/lib/ue-launch';
import { parseScenarioVerdict } from '@/lib/test-gate-runner/spawnExecutor';
import type { GateAssertion } from '@/lib/test-gate-runner/types';
import { createExperimentRun } from './editor-process';
import { captureDirFor, captureFileFor, ensureCaptureDir } from './capture-store';
// The settle ceilings live beside the client's poll-budget derivation so the number the
// browser quotes when it gives up is provably the number spent here.
import { EXPERIMENT_SETTLE_MS } from './poll-budget';
import {
  detectRunningEditors,
  editorPreconditionReason,
  leaseConflictReason,
  drainEditorLease,
  type EditorLease,
  type RunningEditor,
} from './editor-precondition';

const DONE = 'POF_EXPERIMENT_DONE';
const ERR = 'POF_EXPERIMENT_ERROR';

/** Build the Python probe: the user body wrapped in try/except with DONE/ERROR
 * markers, plus an optional screenshot call before DONE. Pure. */
export function buildExperimentProbe(
  python: string,
  opts: { capturePath?: string; resX?: number; resY?: number } = {},
): string {
  const body = python.split('\n').map((l) => '    ' + l);
  const cap = opts.capturePath
    ? [`    unreal.AutomationLibrary.take_high_res_screenshot(${opts.resX ?? 1280}, ${opts.resY ?? 720}, '${opts.capturePath}')`]
    : [];
  return [
    'import unreal',
    'try:',
    ...body,
    ...cap,
    `    unreal.log('${DONE}=ok')`,
    'except Exception as e:',
    `    unreal.log('${ERR}=' + repr(e))`,
    '',
  ].join('\n');
}

export interface ExperimentArgsInput {
  uproject: string;
  probePath: string;
  abslog: string;
  capture?: boolean;
  /** Extra engine plugins to enable for this run (beyond PythonScriptPlugin), for
   *  experiments that touch a plugin not enabled in the .uproject (e.g. the Chaos
   *  Cloth Asset plugins). Merged into a single comma-list `-EnablePlugins` flag. */
  enablePlugins?: string[];
}

/** Editor argv for an experiment run. Reuses `buildLaunchArgs`: capture → render
 * (`-RenderOffScreen`, no `-nullrhi`); else headless. Pure. */
export function buildExperimentArgs(i: ExperimentArgsInput): string[] {
  const pluginFlag = `-EnablePlugins=${['PythonScriptPlugin', ...(i.enablePlugins ?? [])].join(',')}`;
  return buildLaunchArgs({
    uproject: i.uproject,
    execCmds: buildPythonExecFile(i.probePath),
    headless: !i.capture,
    abslog: i.abslog,
    extraArgs: i.capture ? ['-RenderOffScreen', pluginFlag] : [pluginFlag],
  });
}

export interface ParsedLog {
  logs: string[];
  markers: Record<string, string>;
  ok: boolean;
  error?: string;
}

/** Extract `LogPython:` lines + their `KEY=VALUE` markers (ignoring the abslog's
 * echoed command line, which is NOT LogPython-prefixed). Pure. */
export function parseExperimentLog(log: string): ParsedLog {
  const logs = log
    .split(/\r?\n/)
    .filter((l) => l.includes('LogPython:'))
    .map((l) => l.replace(/^.*LogPython:\s?/, '').trim());
  const markers: Record<string, string> = {};
  for (const line of logs) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) markers[m[1]] = m[2].trim();
  }
  return {
    logs,
    markers,
    ok: markers[DONE] !== undefined && markers[ERR] === undefined,
    error: markers[ERR],
  };
}

export interface ObservationSample {
  t?: number;
  loc_x?: number; loc_y?: number; loc_z?: number;
  speed?: number; anim_speed?: number; montage_playing?: boolean;
  health?: number; stamina?: number; mana?: number;
  [k: string]: number | boolean | undefined;
}

export interface ObservationSummary {
  sampleCount: number;
  maxSpeed: number;
  maxAnimSpeed: number;
  displacement: number;
  montagePlayed: boolean;
}

/** Reduce a scenario's observation samples to a headline behavioral summary. Pure. */
export function summarizeObservations(samples: ObservationSample[]): ObservationSummary {
  let maxSpeed = 0, maxAnimSpeed = 0, montagePlayed = false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of samples) {
    if ((s.speed ?? 0) > maxSpeed) maxSpeed = s.speed!;
    if ((s.anim_speed ?? 0) > maxAnimSpeed) maxAnimSpeed = s.anim_speed!;
    if (s.montage_playing) montagePlayed = true;
    if (typeof s.loc_x === 'number') { minX = Math.min(minX, s.loc_x); maxX = Math.max(maxX, s.loc_x); }
    if (typeof s.loc_y === 'number') { minY = Math.min(minY, s.loc_y); maxY = Math.max(maxY, s.loc_y); }
  }
  const dx = Number.isFinite(maxX) ? maxX - minX : 0;
  const dy = Number.isFinite(maxY) ? maxY - minY : 0;
  return { sampleCount: samples.length, maxSpeed, maxAnimSpeed, displacement: Math.sqrt(dx * dx + dy * dy), montagePlayed };
}

function parseObservations(raw: string): ObservationSample[] {
  try {
    const j = JSON.parse(raw) as { samples?: ObservationSample[] };
    return Array.isArray(j?.samples) ? j.samples : [];
  } catch {
    return [];
  }
}

export interface ScenarioSpec {
  map?: string;
  inputs?: CaptureScenarioInput[];
  totalSeconds?: number;
  numSamples?: number;
  settle?: number;
  /** Destroy AI-possessed pawns at start so combat can't interfere (e.g. isolate locomotion
   *  — enemies otherwise stagger the player into a CanMove()-false state). */
  disableAI?: boolean;
  /** Behavioral assertions judged against the observations (reuses the gate-runner's
   *  parseScenarioVerdict): moved / animated / static / montage-playing / attribute-drop. */
  assert?: GateAssertion[];
}

/**
 * The four visual checks `/api/verify/visual` implements. Each owns a SERVER-SIDE prompt; the
 * mode is the whole of what a caller chooses. The lab used to send a free-text `prompt` the
 * route never declared and always discarded — the control is gone, this one is honoured
 * end-to-end (and a user-authored judge rubric would be a hole: a subject who can edit the
 * judge's instructions can write "answer pass").
 */
export type VisualCheckMode = 'hud' | 'texture' | 'lighting' | 'character';

export const VISUAL_CHECK_MODES: readonly VisualCheckMode[] = ['character', 'hud', 'lighting', 'texture'];

/** Verdict status. `deferred` = the judge could not run — NOT an observed failure. */
export type VerdictStatus = 'pass' | 'fail' | 'deferred';

export interface VisualVerdict {
  status: VerdictStatus;
  detail: string;
}

export interface ExperimentSpec {
  python: string;
  capture?: boolean;
  verify?: { mode: VisualCheckMode };
  /** Scenario mode: drive `-game -PoFScenario` (player + inputs) and observe behavioral
   *  metrics + the peak-action frame instead of running a Python probe. */
  scenario?: ScenarioSpec;
  resX?: number;
  resY?: number;
  settleMs?: number;
  uproject?: string;
  engine?: string;
  /** Extra engine plugins to enable (beyond PythonScriptPlugin) for a probe that
   *  touches a plugin not enabled in the .uproject (e.g. Chaos Cloth Asset). */
  enablePlugins?: string[];
  /** Explicit user override of the live-editor precondition: launch a second editor beside
   *  the operator's own instead of refusing. Never kills the running editor — see
   *  `editor-precondition.ts`. The drain lease stays non-overridable. */
  allowRunningEditor?: boolean;
}

export interface ExperimentResult {
  ok: boolean;
  error?: string;
  /** The run never started: a precondition refused it (live editor / drain lease held). The
   *  `error` carries the named reason. Distinct from a failed run — nothing was observed. */
  refused?: boolean;
  logs: string[];
  markers: Record<string, string>;
  screenshotPath?: string;
  verdict?: VisualVerdict;
  /** Scenario mode only: the captured behavioral samples (capped) + their summary + the
   *  assertion verdict (if assertions were given). */
  observations?: ObservationSample[];
  observationSummary?: ObservationSummary;
  behavioralVerdict?: { status: 'pass' | 'fail'; detail: string };
  durationMs: number;
  binary: string;
  args: string[];
}

type RunFn = (binary: string, args: string[], settleMs: number) => Promise<void>;

export type VerifyVisualFn = (screenshotPath: string, mode: VisualCheckMode) => Promise<VisualVerdict>;

export interface RunnerDeps {
  /** Spawn the editor, let it run `settleMs`, then kill. Default: real spawn + taskkill. */
  run?: RunFn;
  /** Visual verify a screenshot (default: POST the app's /api/verify/visual). */
  verifyVisual?: VerifyVisualFn;
  /** Identity this run is recorded under in `visual_verifications` (the job id). */
  runId?: string;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: EnvLike;
  /** Live-editor probe (default: `tasklist`). Injectable so tests never read the process table. */
  detectEditors?: () => RunningEditor[];
  /** Editor lease (default: the gate-runner's global drain lease). */
  editorLease?: EditorLease;
}

function err(message: string, binary = '', args: string[] = []): ExperimentResult {
  return { ok: false, error: message, logs: [], markers: {}, durationMs: 0, binary, args };
}

function refuse(message: string, binary: string): ExperimentResult {
  return { ...err(message, binary), refused: true };
}

/** Run one ad-hoc experiment on the connected UE editor and return its observed output. */
export async function runExperiment(spec: ExperimentSpec, deps: RunnerDeps = {}): Promise<ExperimentResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const uproject = spec.uproject ?? env.POF_UE_UPROJECT;
  if (!uproject) return err('POF_UE_UPROJECT not set (path to the PoF .uproject)');

  // Resolve WITH provenance: a missing binary must say what it looked for and every
  // variable it consulted, so a moved engine install is a fixable error rather than a
  // path the user never configured plus advice to set two variables they do not use.
  const resolved = resolveEditorBinaryDetailed(
    { windowed: !!spec.capture || !!spec.scenario, ...(spec.engine ? { engine: spec.engine } : {}) },
    env,
  );
  const binary = resolved.binary;
  if (!fileExists(binary)) return err(editorNotFoundMessage(resolved), binary);

  // ── Preconditions: refuse, never kill (see editor-precondition.ts) ──────────
  if (!spec.allowRunningEditor) {
    const reason = editorPreconditionReason((deps.detectEditors ?? (() => detectRunningEditors()))());
    if (reason) return refuse(reason, binary);
  }
  const lease = deps.editorLease ?? drainEditorLease;
  const held = lease.acquire();
  if (!held.ok) return refuse(leaseConflictReason(held.conflict), binary);

  const stamp = now();
  const ctx: ScenarioCtx = {
    uproject, binary, run, now, env,
    ...(deps.verifyVisual ? { verifyVisual: deps.verifyVisual } : {}),
    runId: deps.runId ?? `exp-${stamp}`,
  };
  try {
    return spec.scenario
      ? await runScenario(spec, ctx)
      : await runPythonProbe(spec, ctx, stamp, fileExists);
  } finally {
    lease.release();
  }
}

/** Editor-Python mode: write the probe, launch, read the abslog, verify the capture. */
async function runPythonProbe(
  spec: ExperimentSpec,
  ctx: ScenarioCtx,
  stamp: number,
  fileExists: (p: string) => boolean,
): Promise<ExperimentResult> {
  const { uproject, binary, run, now, env } = ctx;
  // The CAPTURE is durable (~/.pof/experiments) — the history persists this path, and a temp
  // path rots into a broken image with the verdict still standing. The probe + abslog stay in
  // tmp: they are consumed within this call and nothing records where they were.
  ensureCaptureDir();
  const outPath = captureFileFor(ctx.runId);
  const probePath = join(tmpdir(), `pof_exp_probe_${stamp}.py`).replace(/\\/g, '/');
  const abslog = join(tmpdir(), `pof_exp_${stamp}.log`).replace(/\\/g, '/');
  writeFileSync(probePath, buildExperimentProbe(spec.python, spec.capture ? { capturePath: outPath, resX: spec.resX, resY: spec.resY } : {}));
  const args = buildExperimentArgs({ uproject, probePath, abslog, capture: spec.capture, enablePlugins: spec.enablePlugins });

  const start = now();
  try {
    await run(binary, args, spec.settleMs ?? EXPERIMENT_SETTLE_MS.python);
  } finally {
    try { unlinkSync(probePath); } catch { /* ignore */ }
  }
  const log = readFileSafe(abslog);
  const parsed = parseExperimentLog(log);
  const screenshotPath = spec.capture && fileExists(outPath) ? outPath : undefined;

  let verdict: ExperimentResult['verdict'];
  if (spec.verify && screenshotPath) {
    const verify = ctx.verifyVisual ?? postVerifyVisual(env, ctx.runId);
    verdict = await verify(screenshotPath, spec.verify.mode);
  }

  return {
    ok: parsed.ok,
    error: parsed.error,
    logs: parsed.logs,
    markers: parsed.markers,
    screenshotPath,
    verdict,
    durationMs: now() - start,
    binary,
    args,
  };
}

function readFileSafe(p: string): string {
  try { return readFileSync(p, 'utf-8'); } catch { return ''; }
}

interface ScenarioCtx {
  uproject: string;
  binary: string;
  run: RunFn;
  now: () => number;
  env: EnvLike;
  verifyVisual?: VerifyVisualFn;
  /** The run identity recorded alongside the verdict in `visual_verifications`. */
  runId: string;
}

/** Scenario mode: drive `-game -PoFScenario` (player + inputs) via captureScenarioFrame,
 * then read the observation samples + pick the peak-action frame. */
async function runScenario(spec: ExperimentSpec, ctx: ScenarioCtx): Promise<ExperimentResult> {
  const scn = spec.scenario!;
  // Durable shot directory (see runPythonProbe) — `shot_NN.png` + observations.json land here.
  ensureCaptureDir();
  const outDir = captureDirFor(ctx.runId);
  const start = ctx.now();
  const shot = await captureScenarioFrame(
    {
      uproject: ctx.uproject,
      ...(scn.map ? { map: scn.map } : {}),
      ...(spec.engine ? { engine: spec.engine } : {}),
      outDir,
      settleMs: spec.settleMs ?? EXPERIMENT_SETTLE_MS.scenario,
      scenario: { totalSeconds: scn.totalSeconds, numSamples: scn.numSamples, settle: scn.settle, inputs: scn.inputs, disableAI: scn.disableAI },
    },
    { run: ctx.run, now: ctx.now },
  );
  const raw = readFileSafe(join(outDir, 'observations.json'));
  let started: boolean | undefined;
  try { started = (JSON.parse(raw) as { started?: boolean }).started; } catch { /* no obs */ }
  const observations = parseObservations(raw);

  let verdict: ExperimentResult['verdict'];
  if (spec.verify && shot) {
    const verify = ctx.verifyVisual ?? postVerifyVisual(ctx.env, ctx.runId);
    verdict = await verify(shot, spec.verify.mode);
  }
  let behavioralVerdict: ExperimentResult['behavioralVerdict'];
  if (scn.assert?.length) {
    behavioralVerdict = parseScenarioVerdict(
      { started: started ?? observations.length > 0, samples: observations } as unknown as Parameters<typeof parseScenarioVerdict>[0],
      scn.assert,
    );
  }

  return {
    ok: observations.length > 0,
    error: observations.length === 0 ? 'no observations produced (scenario did not run / UScenarioController missing)' : undefined,
    logs: [],
    markers: {},
    observations: observations.slice(0, 60),
    observationSummary: summarizeObservations(observations),
    behavioralVerdict,
    screenshotPath: shot ?? undefined,
    verdict,
    durationMs: ctx.now() - start,
    binary: ctx.binary,
    args: [],
  };
}

// ── default seams (not unit-tested; exercised by the live acceptance run) ──────

/**
 * Spawn the editor, let it settle, then kill ONLY our own PID tree. Previously this also issued
 * two unscoped `taskkill /IM UnrealEditor*.exe /F` sweeps — see `editor-process.ts` for why they
 * are gone and must never come back.
 */
const defaultRun: RunFn = createExperimentRun();

/** The `moduleId` every experiment verdict is filed under in `visual_verifications`. */
export const EXPERIMENT_MODULE_ID = 'experiment';

/**
 * The real visual-verify seam: POST the app's `/api/verify/visual` and map its envelope to a
 * verdict. Two bugs lived here and this is the shape that fixes both.
 *
 * 1. **It never ran.** The body omitted `moduleId` + `itemId`, which the route REQUIRES — so
 *    every call 400'd, `json.data` was undefined, and the seam returned its own literal
 *    `{ status: 'fail' }`. A comparison that never happened read as an observed defect. The ids
 *    now go with the request (ported from `test-gate-runner/visualExecutor.ts`), which also
 *    means every experiment verdict is queryable via `listVisualVerifications('experiment')`.
 * 2. **A judge outage is not a failure.** 4xx/5xx, a missing key, a transport error or an
 *    unrecognised reply shape are all `deferred` WITH the reason — never a red fail. Same
 *    discrimination `visualExecutor` makes, and the reason names what actually happened.
 *
 * Note the envelope: the route returns the model's own verdict object (`{ verdict, notes }`),
 * NOT `{ status, detail }` — the old seam would have mis-read the shape even with the ids.
 */
export function postVerifyVisual(env: EnvLike, runId: string, fetchImpl: typeof fetch = fetch): VerifyVisualFn {
  return async (screenshotPath, mode) => {
    const origin = env.POF_APP_ORIGIN ?? `http://127.0.0.1:${env.PORT ?? 3000}`;
    const defer = (why: string): VisualVerdict => ({
      status: 'deferred',
      detail: `visual ${mode}: auto-judge unavailable (${why}) — frame captured for review (${screenshotPath})`,
    });
    let res: Response;
    try {
      res = await fetchImpl(`${origin}/api/verify/visual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: EXPERIMENT_MODULE_ID,
          itemId: runId,
          screenshotPath,
          mode,
        }),
      });
    } catch (e) {
      return defer(e instanceof Error ? e.message : 'verify request failed');
    }
    const envelope = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { verdict?: string; notes?: string }; error?: string }
      | null;
    if (!res.ok || !envelope?.success) return defer(envelope?.error ?? `HTTP ${res.status}`);
    const verdict = envelope.data?.verdict;
    // An unrecognised reply shape is an outage of the judge, not a fail: never let a shape
    // mismatch condemn a frame nobody actually judged.
    if (verdict !== 'pass' && verdict !== 'fail') return defer('judge returned an unrecognised verdict shape');
    const notes = envelope.data?.notes;
    return { status: verdict, detail: `visual ${mode}: ${verdict}${notes ? ` — ${notes}` : ''} (frame: ${screenshotPath})` };
  };
}
