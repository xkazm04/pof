import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

/**
 * The shape of `node:child_process`'s `spawn`, narrowed to the form the
 * packaging pipeline uses. Injectable so cook/smoke/preflight orchestration can
 * be unit-tested without launching a real process — pass `spawn as unknown as
 * SpawnFn` for the real thing, or a fake in tests.
 */
export type SpawnFn = (cmd: string, args: string[], opts?: SpawnOptions) => ChildProcess;

export interface SpawnCaptureOptions {
  /** Abort signal; firing it kills the child with SIGTERM. */
  signal?: AbortSignal;
  /** Kill the child after this many ms. Omit (or 0) for no timeout. */
  timeoutMs?: number;
  /** Injectable spawn for tests. Defaults to node:child_process spawn. */
  spawnFn?: SpawnFn;
}

export interface SpawnCaptureResult {
  /** Combined stdout + stderr captured over the child's lifetime. */
  output: string;
  /** Message if the process could not be launched or errored, else null. */
  spawnError: string | null;
}

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Spawn a child, accumulate stdout+stderr, and resolve with the captured output
 * (and a spawn error if the process could not be launched). The caller judges
 * success by parsing the output — e.g. UBT prints an explicit Result line, and a
 * headless `UnrealEditor-Cmd` exits non-zero on a benign shutdown null-deref so
 * its exit code is not trustworthy.
 *
 * Abort wiring and the timeout timer are both torn down on exit/error so a
 * resolved capture leaves no dangling listeners or timers.
 */
export function spawnCapture(
  cmd: string,
  args: string[],
  opts: SpawnCaptureOptions = {},
): Promise<SpawnCaptureResult> {
  const { signal, timeoutMs, spawnFn = spawn as unknown as SpawnFn } = opts;
  return new Promise((resolve) => {
    let output = '';
    let child: ChildProcess;
    try {
      child = spawnFn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ output: '', spawnError: errMessage(err) });
      return;
    }

    const kill = () => { try { child.kill('SIGTERM'); } catch { /* noop */ } };

    const timer = timeoutMs ? setTimeout(kill, timeoutMs) : undefined;
    const onAbort = () => kill();
    signal?.addEventListener('abort', onAbort);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    child.stdout?.setEncoding('utf-8');
    child.stdout?.on('data', (d: string) => { output += d; });
    child.stderr?.setEncoding('utf-8');
    child.stderr?.on('data', (d: string) => { output += d; });

    child.once('error', (err) => {
      cleanup();
      resolve({ output, spawnError: errMessage(err) });
    });
    child.once('exit', () => {
      cleanup();
      resolve({ output, spawnError: null });
    });
  });
}
