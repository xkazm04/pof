/**
 * ARDY runner — the app seam for text→motion generation.
 *
 * Drives `scripts/generate.py` in the ARDY checkout (`POF_ARDY_ROOT`) to turn a text prompt
 * into a `.npz` motion clip on the GPU. Same shape as `triposr-runner.ts` / `hunyuan-runner.ts`:
 * pure cores (args/parse/env) plus an injectable spawn seam, so the orchestration is
 * unit-tested without a GPU or a 16 GB model install.
 *
 * Named as "remaining" by four sessions between 2026-07-15 and 2026-07-16 while the chain ran
 * entirely from hand-typed shell commands. Two things make that costly beyond convenience:
 *
 *  - **ARDY is third-party**, so it emits no `POF_*` marker protocol. `parseArdyOutput` reads
 *    the script's own stdout, captured verbatim from live runs on 2026-08-19.
 *  - **Two env vars are load-bearing.** Without `TEXT_ENCODERS_DIR` + `TEXT_ENCODER_MODE=local`
 *    ARDY reaches for the GATED `meta-llama/Meta-Llama-3-8B-Instruct` on Hugging Face instead of
 *    the locally-assembled encoder. `resolveArdyEnv` is the one place that is decided.
 *
 * `preflightArdy` exists because this install silently vanished once already (2026-08-19: the
 * spec still read "PROVEN LIVE" while nothing was on disk) and because the `motion_correction`
 * C++ extension fails OPEN — `import MotionCorrection` succeeds by resolving the repo's source
 * folder as an empty namespace package, so foot-skate correction disappears with no error.
 * A doc claiming a proven pipeline should carry a runnable check, not prose.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export interface ArdySpec {
  /** Text prompt describing the motion. */
  prompt: string;
  /** Output stem. A value containing a separator writes there; a bare name lands in ARDY's
   *  own `outputs/`. Pass a path when the caller needs to know where the file went. */
  outputPath: string;
  /** Clip length in seconds (default 4). */
  durationSec?: number;
  /** Seed. Required for the fix path: correcting a clip means regenerating THIS one. */
  seed?: number;
  /** Model nickname (default 'core' — the Core-27 skeleton PoF's retarget rig is built for). */
  model?: string;
  /** Saved kinematic-constraint list (see docs/research/motion-constraint-fix-path-spec.md). */
  constraintsPath?: string;
  /** `[textWeight, constraintWeight]`. Note the constraint component does NOT strengthen a
   *  pin — measured 2026-08-19, pins land exactly at the default and raising it only bends
   *  the surrounding motion. Exposed for completeness, not as an enforcement lever. */
  cfgWeight?: [number, number];
  diffusionSteps?: number;
  /** Skip foot-skate post-processing. Required if `motion_correction` is not installed. */
  noPostprocess?: boolean;
  /** ARDY checkout (holding `scripts/generate.py` + `.venv/`); else `POF_ARDY_ROOT`. */
  ardyRoot?: string;
  venvPython?: string;
  /** Locally-assembled LLM2Vec encoder dir; else `<root>/text_encoders`. */
  textEncodersDir?: string;
  scriptPath?: string;
  timeoutMs?: number;
}

export interface ArdyResult {
  ok: boolean;
  error?: string;
  npzPath?: string;
  frames?: number;
  fps?: number;
  durationSec?: number;
  model?: string;
  device?: string;
  durationMs: number;
}

/** Build the python argv. Pure. */
export function buildArdyArgs(scriptPath: string, spec: ArdySpec): string[] {
  const args = [
    scriptPath,
    spec.prompt,
    '--model', spec.model ?? 'core',
    '--duration', String(spec.durationSec ?? 4),
    '--output', spec.outputPath,
  ];
  // Omit rather than default: ARDY's own default seed is "random", and forcing 0 would make
  // every un-seeded call return the same clip.
  if (spec.seed !== undefined) args.push('--seed', String(spec.seed));
  if (spec.constraintsPath) args.push('--constraints', spec.constraintsPath);
  if (spec.diffusionSteps !== undefined) args.push('--diffusion_steps', String(spec.diffusionSteps));
  if (spec.cfgWeight) args.push('--cfg_weight', String(spec.cfgWeight[0]), String(spec.cfgWeight[1]));
  if (spec.noPostprocess) args.push('--no-postprocess');
  return args;
}

/**
 * The environment ARDY needs to use the LOCAL encoder assembly. Pure.
 *
 * Without these two vars the text encoder falls back to the gated HF repo, which either fails
 * on auth or silently pulls a different model — so this is a correctness seam, not config.
 */
export function resolveArdyEnv(
  root: string,
  spec: ArdySpec,
  base: Record<string, string | undefined> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined) env[k] = v;
  env.TEXT_ENCODERS_DIR = spec.textEncodersDir ?? join(root, 'text_encoders');
  env.TEXT_ENCODER_MODE = 'local';
  return env;
}

export interface ParsedArdy {
  ok: boolean;
  npzPath?: string;
  frames?: number;
  fps?: number;
  durationSec?: number;
  model?: string;
  device?: string;
  error?: string;
}

/**
 * Parse ARDY's own stdout. Pure.
 *
 * Formats captured verbatim from live runs (ARDY 0.2.0, 2026-08-19):
 *   Using device: cuda:0
 *   Loaded model: ARDY-Core-RP-20FPS-Horizon40
 *   Will generate 'a person walks forward...' with 80 frames (4.0s at 20 fps)
 *   Saving the npz output to outputs\pof_walk.npz
 */
export function parseArdyOutput(stdout: string): ParsedArdy {
  const one = (re: RegExp): string | undefined => stdout.match(re)?.[1]?.trim();

  const trace = /^Traceback \(most recent call last\):/m.test(stdout);
  const npzPath = one(/^Saving the npz output to (.+)$/m);
  const shape = stdout.match(/with (\d+) frames \(([\d.]+)s at (\d+) fps\)/);

  // A python traceback can still be followed by nothing at all, so absence of the save line
  // is the real failure signal — never report ok on a stdout we did not understand.
  const error = trace
    ? (stdout.match(/^(\w*(?:Error|Exception).*)$/m)?.[1]?.trim() ?? 'python traceback (see stdout)')
    : npzPath
      ? undefined
      : 'ARDY did not report a saved npz';

  return {
    ok: !!npzPath && !trace,
    npzPath,
    frames: shape ? Number(shape[1]) : undefined,
    durationSec: shape ? Number(shape[2]) : undefined,
    fps: shape ? Number(shape[3]) : undefined,
    model: one(/^Loaded model: (.+)$/m),
    device: one(/^Using device: (.+)$/m),
    error,
  };
}

type RunFn = (
  cmd: string,
  args: string[],
  timeoutMs: number,
  env?: Record<string, string>,
  cwd?: string,
) => Promise<{ stdout: string; code: number | null }>;

export interface ArdyDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string): ArdyResult {
  return { ok: false, error: message, durationMs: 0 };
}

interface Resolved {
  root: string;
  py: string;
  script: string;
}

/** Resolve + existence-check the install. Shared by `runArdy` and `preflightArdy`. */
function resolveInstall(
  spec: Pick<ArdySpec, 'ardyRoot' | 'venvPython' | 'scriptPath'>,
  env: Record<string, string | undefined>,
  fileExists: (p: string) => boolean,
): Resolved | string {
  const root = spec.ardyRoot ?? env.POF_ARDY_ROOT;
  if (!root) return 'POF_ARDY_ROOT not set (path to the ARDY checkout with scripts/ + .venv/)';
  if (!fileExists(root)) return `ARDY checkout not found at ${root} — the install is gone, not misconfigured`;
  const py = spec.venvPython ?? join(root, '.venv', 'Scripts', 'python.exe');
  if (!fileExists(py)) return `ARDY venv python not found at ${py} (create the venv + install deps)`;
  const script = spec.scriptPath ?? join(root, 'scripts', 'generate.py');
  if (!fileExists(script)) return `generate.py not found at ${script}`;
  return { root, py, script };
}

export interface ArdyPreflight {
  ok: boolean;
  /** Each check, in the order run, with the reason when it failed. */
  checks: { name: string; ok: boolean; detail?: string }[];
}

/**
 * Verify the install can actually generate, rather than trusting a doc that says it can.
 *
 * The `motion_correction` check is the important one and is deliberately an IMPORT of the
 * lowercase module: `import MotionCorrection` succeeds even when the C++ extension was never
 * built, because Python resolves the repo's source directory as an empty namespace package.
 */
export async function preflightArdy(
  spec: Pick<ArdySpec, 'ardyRoot' | 'venvPython' | 'scriptPath' | 'textEncodersDir'> = {},
  deps: ArdyDeps = {},
): Promise<ArdyPreflight> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const run = deps.run ?? defaultRun;
  const checks: ArdyPreflight['checks'] = [];

  const resolved = resolveInstall(spec, env, fileExists);
  if (typeof resolved === 'string') {
    checks.push({ name: 'install', ok: false, detail: resolved });
    return { ok: false, checks };
  }
  checks.push({ name: 'install', ok: true, detail: resolved.root });

  const encoders = spec.textEncodersDir ?? join(resolved.root, 'text_encoders');
  const hasEncoders = fileExists(encoders);
  checks.push({
    name: 'text_encoders',
    ok: hasEncoders,
    detail: hasEncoders ? encoders : `missing at ${encoders} — ARDY would fall back to the GATED meta-llama repo`,
  });

  const probe = 'import torch;from motion_correction import motion_postprocess;print("POF_ARDY_PREFLIGHT_OK",torch.cuda.is_available())';
  const { stdout } = await run(resolved.py, ['-c', probe], 120_000);
  const line = stdout.match(/^POF_ARDY_PREFLIGHT_OK (True|False)$/m);
  checks.push({
    name: 'motion_correction',
    ok: !!line,
    detail: line
      ? undefined
      : 'C++ extension not importable — run `pip install ./MotionCorrection --no-cache-dir --no-build-isolation`. '
        + 'Note `import MotionCorrection` (capitalised) would have SUCCEEDED here as an empty namespace package.',
  });
  checks.push({
    name: 'cuda',
    ok: line?.[1] === 'True',
    detail: line?.[1] === 'True' ? undefined : 'torch reports no CUDA device — generation would run on CPU or fail',
  });

  return { ok: checks.every((c) => c.ok), checks };
}

/** Run ARDY text→motion and return the observed result. */
export async function runArdy(spec: ArdySpec, deps: ArdyDeps = {}): Promise<ArdyResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  if (!spec.prompt.trim()) return err('prompt is empty');
  if (spec.constraintsPath && !fileExists(spec.constraintsPath)) {
    return err(`constraints file not found at ${spec.constraintsPath}`);
  }

  const resolved = resolveInstall(spec, env, fileExists);
  if (typeof resolved === 'string') return err(resolved);

  const args = buildArdyArgs(resolved.script, spec);
  const runEnv = resolveArdyEnv(resolved.root, spec, env);
  const start = now();
  // cwd MUST be the checkout. ARDY resolves relative --output against its own cwd, so without
  // this a bare/relative stem writes into whatever directory the CALLER happens to be in —
  // observed 2026-08-19 dropping an `outputs/` folder straight into the PoF repo.
  const { stdout } = await run(resolved.py, args, spec.timeoutMs ?? 900_000, runEnv, resolved.root);
  const parsed = parseArdyOutput(stdout);

  // ARDY prints a path relative to ITS cwd ("outputs\name.npz"). Resolve against the checkout
  // first — checking the caller's cwd first would "find" a same-named stray and report success
  // for a file written in the wrong place, which is exactly how the cwd bug hid.
  const reported = parsed.npzPath;
  const abs = reported && !isAbsolute(reported) ? join(resolved.root, reported) : reported;
  const npzPath = abs && fileExists(abs) ? abs : undefined;

  return {
    ok: parsed.ok && !!npzPath,
    error: parsed.error ?? (parsed.ok && !npzPath ? `npz not written despite save line (${reported})` : undefined),
    npzPath,
    frames: parsed.frames,
    fps: parsed.fps,
    durationSec: parsed.durationSec,
    model: parsed.model,
    device: parsed.device,
    durationMs: now() - start,
  };
}

// ── default spawn seam (not unit-tested; exercised by the live smoke run) ──────
const defaultRun: RunFn = async (cmd, args, timeoutMs, env, cwd) => {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    // Type the options explicitly: with an optional `cwd` inferred inline, TS reduces the
    // spawn overload set to `never`.
    const opts: import('node:child_process').SpawnOptions = {
      windowsHide: true,
      // This project augments ProcessEnv with required keys (NODE_ENV), which a plain
      // Record<string, string> cannot satisfy; the child only needs the string map.
      env: (env ?? process.env) as NodeJS.ProcessEnv,
      cwd,
    };
    const child = spawn(cmd, args, opts);
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.on('exit', (code: number | null) => { clearTimeout(timer); resolve({ stdout, code }); });
    child.on('error', () => { clearTimeout(timer); resolve({ stdout, code: null }); });
  });
};
