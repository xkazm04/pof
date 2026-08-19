/**
 * Experiment editor process control — spawn ONE editor and kill exactly what we spawned.
 *
 * **Repo law: never kill by image name.** This runner used to follow its correct PID-tree
 * kill with `taskkill /IM UnrealEditor.exe /F` and `/IM UnrealEditor-Cmd.exe /F`. Those two
 * sweeps are machine-wide and unconditional: running ANY experiment destroyed the operator's
 * open editor (with unsaved work) and any concurrent drain's headless editor — which the drain
 * then mis-read as its own spawn failure. `/T` already walks OUR spawned process TREE, so the
 * image-name sweeps bought nothing a PID kill doesn't; they only killed other people's work.
 *
 * The same hazard was removed from `@/lib/ue-launch/capture.ts` in an earlier wave, so the
 * spawn/kill lifecycle is REUSED from there (`createCaptureRun` + `buildPidKillArgs`) rather
 * than re-derived — one law, one implementation. The `exec` seam exists so a test can observe
 * every command this module issues and prove none of them names an image.
 */
import { execFileSync, type spawn } from 'node:child_process';
import { logger } from '@/lib/logger';
import { buildPidKillArgs, createCaptureRun } from '@/lib/ue-launch/capture';

/** Run one process to completion, ignoring its output. Injectable so tests observe commands. */
export type ExecSeam = (cmd: string, args: string[]) => void;

const defaultExec: ExecSeam = (cmd, args) => { execFileSync(cmd, args, { stdio: 'ignore' }); };

/**
 * Kill exactly one spawned process TREE, by PID. The ONLY kill this subsystem performs.
 * A missing PID is a no-op (nothing of ours is running), never a broader sweep.
 */
export function killSpawnedTree(pid: number | undefined, exec: ExecSeam = defaultExec): void {
  if (!pid) return;
  try {
    exec('taskkill', buildPidKillArgs(pid));
  } catch (e) {
    logger.debug(`[ue-experiment] PID ${pid} already gone (${e instanceof Error ? e.message : String(e)})`);
  }
}

/**
 * The experiment run seam: spawn the editor, let it run `settleMs` (or until it self-exits),
 * then kill OUR pid tree. Delegates the lifecycle to the proven `createCaptureRun`.
 */
export function createExperimentRun(
  deps: { spawnFn?: typeof spawn; exec?: ExecSeam } = {},
): (binary: string, args: string[], settleMs: number) => Promise<void> {
  const exec = deps.exec ?? defaultExec;
  return createCaptureRun({
    ...(deps.spawnFn ? { spawnFn: deps.spawnFn } : {}),
    kill: (pid) => killSpawnedTree(pid, exec),
  });
}
