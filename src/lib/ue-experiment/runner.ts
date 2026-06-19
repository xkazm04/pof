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
import { buildLaunchArgs, buildPythonExecFile, resolveEditorBinary, captureScenarioFrame, type EnvLike, type CaptureScenarioInput } from '@/lib/ue-launch';
import { parseScenarioVerdict } from '@/lib/test-gate-runner/spawnExecutor';
import type { GateAssertion } from '@/lib/test-gate-runner/types';

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
}

/** Editor argv for an experiment run. Reuses `buildLaunchArgs`: capture → render
 * (`-RenderOffScreen`, no `-nullrhi`); else headless. Pure. */
export function buildExperimentArgs(i: ExperimentArgsInput): string[] {
  return buildLaunchArgs({
    uproject: i.uproject,
    execCmds: buildPythonExecFile(i.probePath),
    headless: !i.capture,
    abslog: i.abslog,
    extraArgs: i.capture
      ? ['-RenderOffScreen', '-EnablePlugins=PythonScriptPlugin']
      : ['-EnablePlugins=PythonScriptPlugin'],
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

export interface ExperimentSpec {
  python: string;
  capture?: boolean;
  verify?: { mode?: string; prompt: string };
  /** Scenario mode: drive `-game -PoFScenario` (player + inputs) and observe behavioral
   *  metrics + the peak-action frame instead of running a Python probe. */
  scenario?: ScenarioSpec;
  resX?: number;
  resY?: number;
  settleMs?: number;
  uproject?: string;
  engine?: string;
}

export interface ExperimentResult {
  ok: boolean;
  error?: string;
  logs: string[];
  markers: Record<string, string>;
  screenshotPath?: string;
  verdict?: { status: 'pass' | 'fail'; detail: string };
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

export interface RunnerDeps {
  /** Spawn the editor, let it run `settleMs`, then kill. Default: real spawn + taskkill. */
  run?: RunFn;
  /** Visual verify a screenshot (default: POST the app's /api/verify/visual). */
  verifyVisual?: (screenshotPath: string, mode: string, prompt: string) => Promise<{ status: 'pass' | 'fail'; detail: string }>;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: EnvLike;
}

function err(message: string, binary = '', args: string[] = []): ExperimentResult {
  return { ok: false, error: message, logs: [], markers: {}, durationMs: 0, binary, args };
}

/** Run one ad-hoc experiment on the connected UE editor and return its observed output. */
export async function runExperiment(spec: ExperimentSpec, deps: RunnerDeps = {}): Promise<ExperimentResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const uproject = spec.uproject ?? env.POF_UE_UPROJECT;
  if (!uproject) return err('POF_UE_UPROJECT not set (path to the PoF .uproject)');

  const binary = resolveEditorBinary({ windowed: !!spec.capture || !!spec.scenario, ...(spec.engine ? { engine: spec.engine } : {}) }, env);
  if (!fileExists(binary)) return err(`UE editor not found at ${binary} (install UE 5.8 or set POF_UE_CMD/POF_UE_EDITOR)`, binary);

  const stamp = now();

  if (spec.scenario) {
    return runScenario(spec, { uproject, binary, run, now, env, verifyVisual: deps.verifyVisual }, stamp);
  }

  const outPath = join(tmpdir(), `pof_exp_${stamp}.png`).replace(/\\/g, '/');
  const probePath = join(tmpdir(), `pof_exp_probe_${stamp}.py`).replace(/\\/g, '/');
  const abslog = join(tmpdir(), `pof_exp_${stamp}.log`).replace(/\\/g, '/');
  writeFileSync(probePath, buildExperimentProbe(spec.python, spec.capture ? { capturePath: outPath, resX: spec.resX, resY: spec.resY } : {}));
  const args = buildExperimentArgs({ uproject, probePath, abslog, capture: spec.capture });

  const start = now();
  try {
    await run(binary, args, spec.settleMs ?? 60_000);
  } finally {
    try { unlinkSync(probePath); } catch { /* ignore */ }
  }
  const log = readFileSafe(abslog);
  const parsed = parseExperimentLog(log);
  const screenshotPath = spec.capture && fileExists(outPath) ? outPath : undefined;

  let verdict: ExperimentResult['verdict'];
  if (spec.verify && screenshotPath) {
    const verify = deps.verifyVisual ?? postVerifyVisual(env);
    verdict = await verify(screenshotPath, spec.verify.mode ?? 'character', spec.verify.prompt);
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
  verifyVisual?: RunnerDeps['verifyVisual'];
}

/** Scenario mode: drive `-game -PoFScenario` (player + inputs) via captureScenarioFrame,
 * then read the observation samples + pick the peak-action frame. */
async function runScenario(spec: ExperimentSpec, ctx: ScenarioCtx, stamp: number): Promise<ExperimentResult> {
  const scn = spec.scenario!;
  const outDir = join(tmpdir(), `pof_exp_scn_${stamp}`).replace(/\\/g, '/');
  const start = ctx.now();
  const shot = await captureScenarioFrame(
    {
      uproject: ctx.uproject,
      ...(scn.map ? { map: scn.map } : {}),
      ...(spec.engine ? { engine: spec.engine } : {}),
      outDir,
      settleMs: spec.settleMs ?? 180_000,
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
    const verify = ctx.verifyVisual ?? postVerifyVisual(ctx.env);
    verdict = await verify(shot, spec.verify.mode ?? 'character', spec.verify.prompt);
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

const defaultRun: RunFn = async (binary, args, settleMs) => {
  const { spawn, execFileSync } = await import('node:child_process');
  await new Promise<void>((resolve) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' });
    const done = () => {
      try { if (child.pid) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ }
      try { execFileSync('taskkill', ['/IM', 'UnrealEditor.exe', '/F'], { stdio: 'ignore' }); } catch { /* none */ }
      try { execFileSync('taskkill', ['/IM', 'UnrealEditor-Cmd.exe', '/F'], { stdio: 'ignore' }); } catch { /* none */ }
      resolve();
    };
    const timer = setTimeout(done, settleMs);
    child.on('error', () => { clearTimeout(timer); resolve(); });
  });
};

function postVerifyVisual(env: EnvLike) {
  return async (screenshotPath: string, mode: string, prompt: string) => {
    const origin = env.POF_APP_ORIGIN ?? `http://127.0.0.1:${env.PORT ?? 3000}`;
    const res = await fetch(`${origin}/api/verify/visual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshotPath, mode, prompt }),
    });
    const json = (await res.json()) as { data?: { status: 'pass' | 'fail'; detail: string } };
    return json.data ?? { status: 'fail' as const, detail: 'verify call failed' };
  };
}
