import { spawn, execFileSync, type ChildProcess, type SpawnOptions } from 'node:child_process';

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
 * The orchestration takes injectable spawn / tasklist / kill / sleep functions
 * so it can be unit-tested without launching a real process.
 */

export type SmokeTestStatus = 'pass' | 'fail';

export interface SmokeTestResult {
  status: SmokeTestStatus;
  /** Was the real game process alive at the end of the observe window? */
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
}

type SpawnFn = (cmd: string, args: string[], opts?: SpawnOptions) => ChildProcess;

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
  /** Returns whether the given image is currently running. */
  tasklistFn?: (image: string) => boolean;
  killImageFn?: (image: string) => void;
  killPidFn?: (pid: number) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULT_OBSERVE_MS = 25_000;
const DEFAULT_LAUNCH_ARGS = ['-windowed', '-ResX=1280', '-ResY=720', '-log'];

/** Does `tasklist` output contain the given image? Case-insensitive substring. */
export function parseTasklistOutput(output: string, image: string): boolean {
  return output.toLowerCase().includes(image.toLowerCase());
}

/**
 * The process image a staged build runs as. Non-Development configs decorate
 * the name with platform + config (`PoF-Win64-Shipping.exe`); a Development
 * build runs as the bare `PoF.exe`.
 */
export function deriveGameImage(projectName: string, platform: string, config: string): string {
  if (config === 'Development') return `${projectName}.exe`;
  return `${projectName}-${platform}-${config}.exe`;
}

// ── Default side-effect implementations ──────────────────────────────────────

function defaultTasklist(image: string): boolean {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], { encoding: 'utf-8' });
    return parseTasklistOutput(out, image);
  } catch {
    return false;
  }
}

function defaultKillImage(image: string): void {
  try {
    execFileSync('taskkill', ['/IM', image, '/T', '/F'], { stdio: 'ignore' });
  } catch { /* not running — fine */ }
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
  const tasklist = opts.tasklistFn ?? defaultTasklist;
  const killImage = opts.killImageFn ?? defaultKillImage;
  const killPid = opts.killPidFn ?? defaultKillPid;
  const sleep = opts.sleep ?? defaultSleep;

  let bootstrapExitCode: number | null = null;
  let spawnError: string | null = null;
  let pid: number | undefined;

  try {
    const child = spawnImpl(opts.bootstrapExe, launchArgs, {
      cwd: opts.bootstrapExe.replace(/[\\/][^\\/]+$/, ''),
      stdio: 'ignore',
    });
    pid = child.pid;
    child.on('exit', (code: number | null) => { bootstrapExitCode = code; });
    child.on('error', (err: Error) => { spawnError = err.message; });
  } catch (err) {
    spawnError = err instanceof Error ? err.message : String(err);
  }

  // Observe, then take the honest liveness reading.
  await sleep(observeMs);
  const gameAlive = spawnError ? false : tasklist(opts.gameImage);

  // Always clean up — kill the game process and the bootstrap, in that order.
  killImage(opts.gameImage);
  if (pid !== undefined) killPid(pid);

  return {
    status: gameAlive ? 'pass' : 'fail',
    gameAlive,
    bootstrapExitCode,
    spawnError,
    observedMs: observeMs,
    gameImage: opts.gameImage,
    bootstrapExe: opts.bootstrapExe,
  };
}

/** A one-line human summary for the build-history `notes` column. */
export function smokeResultNote(result: SmokeTestResult): string {
  if (result.status === 'pass') {
    return `smoke-test: pass (${result.gameImage} survived ${Math.round(result.observedMs / 1000)}s)`;
  }
  const reason = result.spawnError ? `launch failed: ${result.spawnError}` : `${result.gameImage} not alive after ${Math.round(result.observedMs / 1000)}s`;
  return `smoke-test: fail (${reason})`;
}
