/**
 * SkinTokens runner — PoF's first NON-HUMANOID auto-rig path.
 *
 * Every rig route PoF had before this is humanoid-shaped or borrowed: MetaHuman conform
 * is humanoid-only (and its assemble is gated on Epic's Optional Content), Tripo's
 * `animate_rig` costs cloud credits and its prerig check only ever returns
 * `rig_type: biped`, and the 5.8 Dataflow rig-transfer needs a DONOR rig of a compatible
 * shape. So the bestiary sat at "3D & Rig" A1 with zero real rigged meshes across 94
 * entities, because nothing local could rig a creature.
 *
 * This drives `skintokens-cli` (localai-org/skin-tokens.cpp, Apache-2.0), a C++23/GGML
 * port of VAST-AI's SkinTokens/TokenRig: a static GLB in, a skinned GLB out with a
 * one-frame rest pose so ordinary glTF viewers evaluate the skin immediately. It needs
 * no CUDA and no flash-attn, which is what made the PyTorch original undeployable here
 * (see docs/research/skintokens-rigging-spec.md).
 *
 * REQUIRES A VULKAN BUILD. "It also runs on CPU" is true and useless: measured
 * 2026-09-07, one 40k-face creature took 24 minutes at ~5.5 of 8 cores, made the
 * workstation unusable, and wrote no output. So `device` defaults to `vulkan` and the
 * CPU device is refused unless a caller passes `allowCpu`. Until the install is rebuilt
 * with `-DSKINTOKENS_ENABLE_VULKAN=ON` (needs the Vulkan SDK), every call through this
 * seam is expected to fail at the device check — which is the honest state, not a bug.
 *
 * Same shape as `triposr-runner.ts`: pure argv/parse cores over an injectable spawn
 * seam, so the orchestration is unit-tested without the model on disk.
 *
 * The argv contract below is read from the CLI's own `usage()` and dispatch in
 * `src/cli.cpp`, not from the README — the README documents Linux only and, e.g.,
 * `--retarget-soma-to-mixamo52` is a FLAG on `skin`, not the standalone subcommand a
 * secondary source described.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gateRig, type RigFacts, type RigGateResult, type RigVerdict } from './rig-gate';

/** What the CLI prints to stdout after a successful rig/skin write. */
export const SKINTOKENS_SUCCESS_MARKER = 'written to';

export type SkintokensDevice = 'auto' | 'cpu' | 'vulkan';
export type SkintokensFit = 'none' | 'global' | 'articulated';

export interface SkintokensSpec {
  /** `rig` predicts skeleton + weights; `skin` reweights against a supplied skeleton. */
  mode?: 'rig' | 'skin';
  /** Static mesh to rig — `.glb`, or TRELLIS.2's `.t2mesh`. */
  meshPath: string;
  /** `skin` only: the GLB carrying the existing armature. */
  skeletonPath?: string;
  /** Full output path; the CLI writes a skinned `.glb`. */
  outputPath: string;
  /**
   * Defaults to `vulkan` — the only device this is viable on. See {@link allowCpu} for
   * the measurement behind that.
   */
  device?: SkintokensDevice;
  /**
   * Opt in to the CPU device, which is refused by default.
   *
   * MEASURED 2026-09-07: `rig` on a 26,788-vert / 39,735-face bestiary creature with
   * `--device cpu` ran **24 minutes**, held ~5.5 of 8 cores and 2.6 GB, made the
   * workstation unusable for anything else, and wrote **no output file**. That is not a
   * slow path to be patient with; it is a path that must not be reachable by accident
   * from a pipeline step.
   */
  allowCpu?: boolean;
  /** `skin`/`bind` only — the CLI rejects `--fit` on `rig`. */
  fit?: SkintokensFit;
  /** Upstream surface-locality heuristic; omit to keep the raw learned weights. */
  postprocess?: boolean;
  beams?: number;
  /**
   * How many times to run the CLI when it CRASHES (never when it reports a real error).
   * Default 8.
   *
   * MEASURED 2026-09-07 on an RTX 4090 (Vulkan 1.4.325, NV_coopmat2): the Vulkan
   * backend crashes nondeterministically on identical input — 10 identical runs of one
   * mesh gave 2 successes / 8 crashes; `GGML_VK_DISABLE_COOPMAT`+`COOPMAT2` moved it to
   * 5/5 and `GGML_VK_DISABLE_ASYNC` to 4/6, so no knob makes it stable and this is a bug
   * in the Vulkan path rather than a tunable. A crash costs ~0.4 s against ~10 s for a
   * success, so retrying is much cheaper than giving up: the real bestiary creature
   * rigged on attempt 3 of 3 in one measurement and 6 of 6 in another.
   */
  maxAttempts?: number;
  /**
   * Skip the Tier-1 rig gate. Off by default: a rig that cannot deform the mesh is not a
   * successful run, however cleanly the CLI exited. When skipped, the result carries NO
   * rig claim at all rather than an assumed-good one.
   */
  skipGate?: boolean;
  /** Install root holding `dist/bin/` + `models/`; else POF_SKINTOKENS_ROOT. */
  skintokensRoot?: string;
  /** Override the CLI path outright. */
  binPath?: string;
  /** Override the model directory (default `<root>/models/SkinTokens-GGUF/F16`). */
  modelDir?: string;
  timeoutMs?: number;
}

export interface SkintokensResult {
  ok: boolean;
  error?: string;
  /** The skinned GLB, only when it is actually on disk. */
  riggedPath?: string;
  /** How many CLI invocations it took — >1 means the Vulkan backend crashed and retried. */
  attempts?: number;
  /** Tier-1 rig verdict. Absent when `skipGate` was set — absent means UNJUDGED, not fine. */
  rig?: RigVerdict;
  /** Structural facts behind {@link rig}. */
  facts?: RigFacts;
  durationMs: number;
}

/**
 * Exit codes that mean the process DIED rather than reported a problem: POSIX
 * 128+SIGSEGV, and Windows' 0xC0000005 access violation in both its signed and unsigned
 * spellings (Node reports one or the other depending on how the child was launched).
 */
export const SKINTOKENS_CRASH_EXIT_CODES = [139, -1073741819, 3221225477] as const;

/** True when the exit code means a crash worth retrying. `null` = spawn error/killed. Pure. */
export function isCrashExit(code: number | null): boolean {
  if (code === null) return true;
  return (SKINTOKENS_CRASH_EXIT_CODES as readonly number[]).includes(code);
}

/** Installed CLI path, or null when it cannot be located. Pure. */
export function resolveSkintokensBin(
  explicit: string | undefined,
  env: Record<string, string | undefined>,
  exists: (p: string) => boolean,
): string | null {
  if (explicit) return explicit;
  const root = env.POF_SKINTOKENS_ROOT;
  if (!root) return null;
  const bin = join(root, 'dist', 'bin', 'skintokens-cli.exe').replace(/\\/g, '/');
  return exists(bin) ? bin : null;
}

/**
 * Model bundle directory, or null. F16 by design: the repo also ships F32, but its own
 * README says that bundle exists for numerical-parity work and normal inference should
 * use F16.
 */
export function resolveSkintokensModelDir(
  explicit: string | undefined,
  env: Record<string, string | undefined>,
  exists: (p: string) => boolean,
): string | null {
  if (explicit) return explicit;
  const root = env.POF_SKINTOKENS_ROOT;
  if (!root) return null;
  const dir = join(root, 'models', 'SkinTokens-GGUF', 'F16').replace(/\\/g, '/');
  return exists(dir) ? dir : null;
}

/** Build the CLI argv. Pure. */
export function buildSkintokensArgs(spec: SkintokensSpec, modelDir: string): string[] {
  const skin = spec.mode === 'skin';
  const args = skin
    ? ['skin', modelDir, spec.meshPath, spec.skeletonPath ?? '', spec.outputPath]
    : ['rig', modelDir, spec.meshPath, spec.outputPath];
  args.push('--device', spec.device ?? 'vulkan');
  // `--fit` is only parsed for skin/bind; passing it to `rig` is a usage error.
  if (skin && spec.fit) args.push('--fit', spec.fit);
  if (spec.postprocess) args.push('--postprocess');
  if (spec.beams !== undefined) args.push('--beams', String(spec.beams));
  return args;
}

export interface ParsedSkintokens {
  ok: boolean;
  writtenPath?: string;
  error?: string;
}

/** Parse the CLI's output + exit code. Pure. */
export function parseSkintokensOutput(output: string, code: number | null): ParsedSkintokens {
  if (code === 2) {
    return { ok: false, error: `skintokens-cli usage error (the argv was built wrong): ${firstLine(output)}` };
  }
  if (code !== 0) {
    return { ok: false, error: firstMeaningfulLine(output) || `skintokens-cli exited ${code}` };
  }
  const m = output.match(new RegExp(`${SKINTOKENS_SUCCESS_MARKER}\\s+(.+)$`, 'm'));
  // Exit 0 with no marker is not success: `inspect` and a no-op both exit 0, and reading
  // either as a completed rig is exactly how a silent no-op ships.
  if (!m) return { ok: false, error: 'skintokens-cli exited 0 without reporting a written file' };
  return { ok: true, writtenPath: m[1].trim() };
}

function firstLine(s: string): string {
  return s.split(/\r?\n/)[0]?.trim() ?? '';
}

/** The first line that isn't ggml's backend chatter — that's the real error. */
function firstMeaningfulLine(s: string): string {
  return (
    s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('load_backend:') && !l.startsWith('ggml_')) ?? ''
  );
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface SkintokensDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
  /** Injectable Tier-1 gate, so the orchestration is testable without a real GLB. */
  gate?: (path: string) => RigGateResult;
}

/** Run skintokens-cli and report only what is observable on disk. */
export async function runSkintokens(
  spec: SkintokensSpec,
  deps: SkintokensDeps = {},
): Promise<SkintokensResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;
  const gate = deps.gate ?? gateRig;
  const start = now();
  const fail = (error: string): SkintokensResult => ({ ok: false, error, durationMs: now() - start });

  const rootEnv = { ...env, POF_SKINTOKENS_ROOT: spec.skintokensRoot ?? env.POF_SKINTOKENS_ROOT };
  const bin = resolveSkintokensBin(spec.binPath, rootEnv, fileExists);
  if (!bin) {
    return fail('skintokens-cli not found — set POF_SKINTOKENS_ROOT to the skin-tokens.cpp install (the dir holding dist/bin/ and models/)');
  }
  const modelDir = resolveSkintokensModelDir(spec.modelDir, rootEnv, fileExists);
  if (!modelDir) {
    return fail('SkinTokens model bundle not found — fetch it with: hf download LocalAI-io/SkinTokens-GGUF --include "F16/*" --local-dir models/SkinTokens-GGUF');
  }
  const device = spec.device ?? 'vulkan';
  if (device !== 'vulkan' && !spec.allowCpu) {
    return fail(
      device === 'auto'
        ? "device 'auto' is refused: a build without Vulkan resolves auto to the CPU, and CPU rigging measured 24 min at ~5.5 cores for one 40k-face creature and wrote nothing. Ask for 'vulkan' explicitly, or pass allowCpu: true to accept the CPU cost."
        : "device 'cpu' is refused: it measured 24 min at ~5.5 cores and 2.6 GB for one 40k-face creature, made the machine unusable, and produced no output. Pass allowCpu: true to accept that, or use 'vulkan'.",
    );
  }
  if (!fileExists(spec.meshPath)) return fail(`input mesh not found: ${spec.meshPath}`);
  if (spec.mode === 'skin') {
    if (!spec.skeletonPath) return fail('skin mode needs a skeleton GLB (spec.skeletonPath)');
    if (!fileExists(spec.skeletonPath)) return fail(`skeleton not found: ${spec.skeletonPath}`);
  }

  const args = buildSkintokensArgs(spec, modelDir);
  const maxAttempts = Math.max(1, spec.maxAttempts ?? 8);
  let attempts = 0;
  let lastError = 'skintokens-cli failed';

  // Retry ONLY crashes. A usage error (exit 2) or a real error (exit 1) is deterministic:
  // repeating it just runs our own bug N times and buries the message.
  for (let i = 0; i < maxAttempts; i++) {
    attempts += 1;
    const { stdout, code } = await run(bin, args, spec.timeoutMs ?? 3_600_000);
    if (isCrashExit(code)) {
      lastError = `skintokens-cli crashed (exit ${code})`;
      continue;
    }
    const parsed = parseSkintokensOutput(stdout, code);
    if (!parsed.ok) return { ...fail(parsed.error ?? lastError), attempts };
    if (!fileExists(spec.outputPath)) {
      return { ...fail(`skintokens-cli reported a write but no file was written at ${spec.outputPath}`), attempts };
    }
    if (spec.skipGate) {
      return { ok: true, riggedPath: spec.outputPath, attempts, durationMs: now() - start };
    }
    // Tier-1 gate. An UNREADABLE output is a failure too: ungated is not the same as
    // passed, and a file we cannot parse is not a rig we can claim.
    const gated = gate(spec.outputPath);
    if (!gated.ok || !gated.verdict) {
      return { ...fail(gated.error ?? 'rig gate could not read the produced GLB'), attempts, riggedPath: spec.outputPath };
    }
    if (!gated.verdict.pass) {
      return {
        ...fail(`produced rig failed the Tier-1 gate: ${gated.verdict.failures.join('; ')}`),
        attempts,
        riggedPath: spec.outputPath,
        rig: gated.verdict,
        facts: gated.facts,
      };
    }
    return {
      ok: true,
      riggedPath: spec.outputPath,
      attempts,
      rig: gated.verdict,
      facts: gated.facts,
      durationMs: now() - start,
    };
  }
  return {
    ...fail(`skintokens-cli crashed ${attempts} time(s) in a row — the Vulkan backend is nondeterministically unstable (last: ${lastError})`),
    attempts,
  };
}

// ── default spawn seam (not unit-tested; exercised by the live smoke run) ──────
const defaultRun: RunFn = async (cmd, args, timeoutMs) => {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); resolve({ stdout, code }); });
    child.on('error', () => { clearTimeout(timer); resolve({ stdout, code: null }); });
  });
};
