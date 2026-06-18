/**
 * launchEditor — the integration seam that spawns a (headless, by default) UE
 * editor and returns its abslog. Composes `resolveEditorBinary` + `buildLaunchArgs`
 * + a watchdog'd spawn. The process runner is injectable so the orchestration is
 * unit-tested without launching a real editor (the spawn mirrors `spawnExecutor`).
 *
 * Result channel: pass `-ExecCmds=py …; unreal.log('KEY=' + value)` and read it
 * back from `result.log` with `extractLogMarker`. A hung editor is SIGKILLed after
 * `timeoutMs` (default 300s — cold start + work).
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveEditorBinary, type ResolveEditorOptions } from './engines';
import { buildLaunchArgs, type LaunchArgsOptions } from './args';

export type LaunchEditorOptions = Omit<LaunchArgsOptions, 'abslog'> & ResolveEditorOptions & {
  /** Watchdog ms; SIGKILL after. Default 300_000. */
  timeoutMs?: number;
  /** Explicit abslog path (default: a temp file). */
  abslog?: string;
};

export interface LaunchEditorResult {
  binary: string;
  args: string[];
  abslog: string;
  /** abslog contents ('' if none was produced). */
  log: string;
  exitCode: number | null;
  timedOut: boolean;
}

interface ProcessRun {
  (binary: string, args: string[], timeoutMs: number): Promise<{ exitCode: number | null; timedOut: boolean }>;
}

export interface LaunchDeps {
  /** Injectable process runner (default: real spawn + watchdog). */
  run?: ProcessRun;
}

const spawnAndWait: ProcessRun = (cmd, args, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let done = false;
    const finish = (exitCode: number | null, timedOut: boolean) => {
      if (done) return;
      done = true;
      resolve({ exitCode, timedOut });
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      finish(null, true);
    }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); finish(code, false); });
    child.on('error', () => { clearTimeout(timer); finish(null, false); });
  });

export async function launchEditor(opts: LaunchEditorOptions, deps: LaunchDeps = {}): Promise<LaunchEditorResult> {
  const run = deps.run ?? spawnAndWait;
  const binary = resolveEditorBinary(opts);
  const abslog = opts.abslog ?? join(tmpdir(), `pof-ue-${Date.now()}.log`);
  const args = buildLaunchArgs({ ...opts, abslog });
  const { exitCode, timedOut } = await run(binary, args, opts.timeoutMs ?? 300_000);
  const log = await readFile(abslog, 'utf-8').catch(() => '');
  return { binary, args, abslog, log, exitCode, timedOut };
}
