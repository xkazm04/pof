/**
 * The one local-process seam for the local generators (TripoSR, Hunyuan3D, TRELLIS.2,
 * ARDY, SkinTokens): spawn, merge stdout+stderr, kill on a ceiling, and report HOW the
 * process ended — an exit code, a kill by our own timer, or a failure to start at all.
 *
 * Each runner used to carry a private copy of this that resolved `{ stdout, code: null }`
 * for a timeout and a spawn error alike, and then built its error from its own script
 * marker only. A process that died without printing that marker (a timeout kill, a native
 * CUDA crash, an argparse exit, a wrong WSL distro) came back `{ ok: false, error:
 * undefined }`, which the forge renders as a bare "generation failed".
 * {@link processFailureReason} is the one sentence for those endings; a runner uses it as
 * `markerError ?? processFailureReason(outcome, …)`, so a script's own marker still wins.
 *
 * Server-only (node:child_process). The mesh-quality spawns (mesh-critique/-finish/-split/
 * -views) still carry their own copies and can adopt this later.
 */

/** How a local process ended. `timedOut` / `spawnError` are optional so a runner's test
 *  fake that returns `{ stdout, code }` stays a valid outcome. */
export interface ProcessOutcome {
  /** stdout and stderr, merged in arrival order. */
  stdout: string;
  /** Exit code; null when the process was killed by a signal or never started. */
  code: number | null;
  /** True when OUR timer killed it at `timeoutMs`. */
  timedOut?: boolean;
  /** The spawn error message (e.g. `spawn python.exe ENOENT`) when it never started. */
  spawnError?: string;
}

export interface LocalProcessOptions {
  timeoutMs: number;
  /** The FULL child environment (default: inherit). Callers overlaying add `...process.env`. */
  env?: Record<string, string | undefined>;
  cwd?: string;
}

/** After `exit`, wait this long for stdio to drain (`close`) so the last output line —
 *  the one {@link processFailureReason} quotes — is not lost. A grandchild still holding
 *  the pipe must not hang the caller, hence a bound rather than waiting on `close` alone. */
const DRAIN_GRACE_MS = 2_000;

/** Spawn `cmd args`, merge its output, kill it at `timeoutMs`, and say how it ended. */
export async function runLocalProcess(
  cmd: string,
  args: string[],
  opts: LocalProcessOptions,
): Promise<ProcessOutcome> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    let stdout = '';
    let code: number | null = null;
    let timedOut = false;
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const settle = (extra: Partial<ProcessOutcome> = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (grace) clearTimeout(grace);
      resolve({ stdout, code, ...(timedOut ? { timedOut } : {}), ...extra });
    };
    const armGrace = () => { if (!grace) grace = setTimeout(() => settle(), DRAIN_GRACE_MS); };

    // Typed explicitly: with an optional `cwd` inferred inline, TS reduces the spawn
    // overload set to `never`. The project augments ProcessEnv with required keys, which a
    // plain string map cannot satisfy; the child only needs the map.
    const spawnOpts: import('node:child_process').SpawnOptions = {
      windowsHide: true,
      ...(opts.env ? { env: opts.env as NodeJS.ProcessEnv } : {}),
      ...(opts.cwd ? { cwd: opts.cwd } : {}),
    };
    const child = spawn(cmd, args, spawnOpts);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch { /* gone */ }
      armGrace(); // a kill that never yields `exit` must still settle
    }, opts.timeoutMs);
    child.on('exit', (c: number | null) => { code = c; armGrace(); });
    child.on('close', (c: number | null) => { if (code === null) code = c; settle(); });
    child.on('error', (e: Error) => settle({ code: null, spawnError: e.message }));
  });
}

/** Read a `KEY=value` stdout marker line (the runners' script protocol). Pure. */
export function readMarker(stdout: string, key: string): string | undefined {
  const m = stdout.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
}

const TAIL_CAP = 300;

/** The last output lines, newest last, capped at {@link TAIL_CAP} chars. NULs stripped so
 *  wsl.exe's UTF-16 output decoded as UTF-8 stays readable. Pure. */
function outputTail(stdout: string): string {
  const lines = stdout.replace(/\u0000/g, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const kept: string[] = [];
  let len = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (kept.length === 0 && line.length > TAIL_CAP) return `…${line.slice(-(TAIL_CAP - 1))}`;
    if (len + line.length + (kept.length ? 3 : 0) > TAIL_CAP) break;
    len += line.length + (kept.length ? 3 : 0);
    kept.unshift(line);
  }
  return kept.join(' | ');
}

function formatCeiling(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`;
}

/**
 * The reason a process that printed no result/error marker failed. Pure.
 * Spawn error → "could not start"; our kill → "timed out after N min"; a signal death →
 * "ended without an exit code"; non-zero → "exited with code X"; zero → "exited 0 without
 * reporting a result". The output tail rides along when there is any.
 */
export function processFailureReason(
  outcome: ProcessOutcome,
  ctx: { tool: string; timeoutMs: number },
): string {
  const tail = outputTail(outcome.stdout);
  const withTail = (s: string) => (tail ? `${s} — last output: ${tail}` : s);
  if (outcome.spawnError) return `could not start ${ctx.tool}: ${outcome.spawnError}`;
  if (outcome.timedOut) return withTail(`${ctx.tool} timed out after ${formatCeiling(ctx.timeoutMs)} and was killed`);
  if (outcome.code === null) return withTail(`${ctx.tool} ended without an exit code (killed by a signal)`);
  if (outcome.code !== 0) return withTail(`${ctx.tool} exited with code ${outcome.code}`);
  return withTail(`${ctx.tool} exited 0 without reporting a result`);
}
