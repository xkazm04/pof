import { spawn, execFileSync } from 'node:child_process';
import { logger } from '@/lib/logger';
import type { SpawnFn } from './process-utils';

/**
 * Post-cook "runnable .exe" smoke-test.
 *
 * Promotes the SP-E vertical-slice spec into a built-in packaging step: after
 * a successful cook, launch the staged bootstrap exe the way a player would,
 * observe for a fixed window, and confirm the *real* game process survives
 * (the honest "it actually runs" signal — the bootstrap can exit while the
 * game keeps running). Then clean up. Closes the "cook succeeded; nobody
 * verified the exe runs" gap.
 *
 * **One build, positively identified.** A process counts as THIS build only when
 * its executable sits under the build's stage directory (the folder holding the
 * bootstrap exe). A same-named game running anywhere else on the machine is a
 * stranger: it neither makes a dead build pass nor gets killed at cleanup. The only
 * kills are by PID — the game processes resolved under the stage dir, then the
 * bootstrap's own tree. There is no by-image-name kill (fleet DECISION 2026-07-27).
 *
 * The orchestration takes injectable spawn / probe / kill / sleep functions so it
 * can be unit-tested without launching a real process.
 */

export type SmokeTestStatus = 'pass' | 'fail';

export interface SmokeTestResult {
  status: SmokeTestStatus;
  /** Was a game process of THIS build alive at the end of the observe window? */
  gameAlive: boolean;
  /** Exit code of the bootstrap process if it exited during the window, else null. */
  bootstrapExitCode: number | null;
  /** Spawn error message, if the bootstrap could not be launched. */
  spawnError: string | null;
  /** How long the test observed before checking liveness. */
  observedMs: number;
  /** The process image checked for liveness (e.g. `PoF-Win64-Shipping.exe`). */
  gameImage: string;
  /** The bootstrap exe that was launched. */
  bootstrapExe: string;
  /** PIDs of this build's game processes found alive (and then killed). */
  gamePids?: number[];
  /** Same-named processes outside the stage dir — not this build, never touched. */
  ignoredPids?: number[];
}

/** One running process a probe resolved: its PID and executable path (null = unreadable). */
export interface ProbedProcess {
  pid: number;
  exePath: string | null;
}

/** Lists the running processes with the given image name, with their executable paths. */
export type ProcessProbe = (image: string) => ProbedProcess[];

export interface SmokeTestOptions {
  /** Full path to the staged bootstrap exe, e.g. `<StageDir>\<ProjectName>.exe`. */
  bootstrapExe: string;
  /** Process image to check for liveness (derive via deriveGameImage). */
  gameImage: string;
  /** Observe window before checking liveness. Default 25s (matches SP-E). */
  observeMs?: number;
  /** Args to launch the bootstrap with. Default windowed 1280x720 with logging. */
  launchArgs?: string[];
  // ── Injectable side-effects (defaults use node:child_process) ──
  spawnFn?: SpawnFn;
  probeFn?: ProcessProbe;
  /** Kill one process tree by PID. */
  killPidFn?: (pid: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_OBSERVE_MS = 25_000;
const DEFAULT_LAUNCH_ARGS = ['-windowed', '-ResX=1280', '-ResY=720', '-log'];
/** An image name safe to put inside a CIM filter — nothing a quote could escape. */
const SAFE_IMAGE = /^[A-Za-z0-9._-]+\.exe$/i;

/**
 * The process image a staged build runs as. Non-Development configs decorate
 * the name with platform + config (`PoF-Win64-Shipping.exe`); a Development
 * build runs as the bare `PoF.exe`.
 */
export function deriveGameImage(projectName: string, platform: string, config: string): string {
  if (config === 'Development') return `${projectName}.exe`;
  return `${projectName}-${platform}-${config}.exe`;
}

/** The folder a bootstrap exe was staged into. */
export function stageDirOf(bootstrapExe: string): string {
  return bootstrapExe.replace(/[\\/][^\\/]+$/, '');
}

const normPath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** Is `exePath` inside `stageDir`? Slash- and case-insensitive; an unreadable path never is. */
export function isUnderStageDir(exePath: string | null, stageDir: string): boolean {
  if (!exePath) return false;
  return normPath(exePath).startsWith(`${normPath(stageDir)}/`);
}

/** Parse `Get-CimInstance ... | ConvertTo-Json` output (one object, an array, or nothing). */
export function parseProcessProbeOutput(output: string): ProbedProcess[] {
  const text = output.trim();
  if (!text) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const out: ProbedProcess[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.ProcessId !== 'number') continue;
    out.push({ pid: o.ProcessId, exePath: typeof o.ExecutablePath === 'string' ? o.ExecutablePath : null });
  }
  return out;
}

// ── Default side-effect implementations ──────────────────────────────────────

function defaultProbe(image: string): ProbedProcess[] {
  if (!SAFE_IMAGE.test(image)) {
    logger.warn(`[smoke-test] refusing to probe an unsafe image name: ${image}`);
    return [];
  }
  const script = `Get-CimInstance Win32_Process -Filter "Name='${image}'" | `
    + 'Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress';
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return parseProcessProbeOutput(out);
  } catch {
    return [];
  }
}

function defaultKillPid(pid: number): void {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch { /* already gone */ }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runSmokeTest(opts: SmokeTestOptions): Promise<SmokeTestResult> {
  const observeMs = opts.observeMs ?? DEFAULT_OBSERVE_MS;
  const launchArgs = opts.launchArgs ?? DEFAULT_LAUNCH_ARGS;
  const spawnImpl = opts.spawnFn ?? (spawn as unknown as SpawnFn);
  const probe = opts.probeFn ?? defaultProbe;
  const killPid = opts.killPidFn ?? defaultKillPid;
  const sleep = opts.sleep ?? defaultSleep;
  const stageDir = stageDirOf(opts.bootstrapExe);

  let bootstrapExitCode: number | null = null;
  let spawnError: string | null = null;
  let pid: number | undefined;

  try {
    const child = spawnImpl(opts.bootstrapExe, launchArgs, { cwd: stageDir, stdio: 'ignore' });
    pid = child.pid;
    child.on('exit', (code: number | null) => { bootstrapExitCode = code; });
    child.on('error', (err: Error) => { spawnError = err.message; });
  } catch (err) {
    spawnError = err instanceof Error ? err.message : String(err);
  }

  // Observe, then take the honest liveness reading — of THIS build's processes only.
  await sleep(observeMs);
  const seen = spawnError ? [] : probe(opts.gameImage);
  const gamePids = seen.filter((p) => isUnderStageDir(p.exePath, stageDir)).map((p) => p.pid);
  const ignoredPids = seen.filter((p) => !gamePids.includes(p.pid)).map((p) => p.pid);
  const gameAlive = gamePids.length > 0;

  // Always clean up: this build's game processes, then the bootstrap tree. By PID only.
  for (const gp of gamePids) killPid(gp);
  if (pid !== undefined) killPid(pid);

  return {
    status: gameAlive ? 'pass' : 'fail',
    gameAlive,
    bootstrapExitCode,
    spawnError,
    observedMs: observeMs,
    gameImage: opts.gameImage,
    bootstrapExe: opts.bootstrapExe,
    gamePids,
    ignoredPids,
  };
}

/** A one-line human summary for the build-history `notes` column. */
export function smokeResultNote(result: SmokeTestResult): string {
  if (result.status === 'pass') {
    return `smoke-test: pass (${result.gameImage} survived ${Math.round(result.observedMs / 1000)}s)`;
  }
  const strangers = result.ignoredPids?.length
    ? `; ${result.ignoredPids.length} same-named process(es) outside the build's stage dir ignored`
    : '';
  const reason = result.spawnError
    ? `launch failed: ${result.spawnError}`
    : `${result.gameImage} not alive after ${Math.round(result.observedMs / 1000)}s${strangers}`;
  return `smoke-test: fail (${reason})`;
}
