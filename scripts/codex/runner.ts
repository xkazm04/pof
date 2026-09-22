/**
 * Spawning and reaping one codex-cli run — shared by the dispatcher (code tasks) and the /diablo
 * producer (step artifacts). Moved out of dispatch.ts so the kill ladder, the stall watchdog and the
 * stdin contract exist once.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const CODEX_JS = process.env.POF_CODEX_JS ?? 'C:/nvm4w/nodejs/node_modules/@openai/codex/bin/codex.js';

/** How a run ended — never collapsed into "succeeded" (registry: subprocess-lifecycle). */
export interface RunEnd { code: number; ended: 'exited' | 'timeout' | 'stalled'; rung?: 'polite' | 'forced' }

/**
 * Minutes of event SILENCE before a run counts as stalled. The `--json` stream carries no
 * reasoning events (verified on cx-001's stream: only messages, commands and file changes), so a
 * long high-effort composition is silent until its final message — a flat 10 min would kill a
 * working xhigh run. Tolerance therefore scales with the reasoning effort.
 */
export function stallMinutes(effort: string): number {
  const env = process.env.POF_CODEX_STALL_MIN;
  if (env) return Number(env);
  return effort === 'low' || effort === 'medium' ? 10 : effort === 'high' ? 25 : 40;
}

/**
 * Kill THIS child's process TREE — `child.kill()` on Windows ends only the node wrapper and
 * orphans codex's native binary and the shells it spawned. Scoped to our own PID (`/T`), never
 * a broad kill by image name. Ladder: polite (`taskkill /T`) → forced (`/T /F`) after 15 s.
 */
export function reapTree(pid: number, onRung: (r: 'polite' | 'forced') => void) {
  onRung('polite');
  spawnSync('taskkill', ['/PID', String(pid), '/T'], { encoding: 'utf8' });
  setTimeout(() => {
    const alive = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' }).stdout.includes(String(pid));
    if (alive) { onRung('forced'); spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' }); }
  }, 15_000).unref();
}

/**
 * Spawn codex (node + codex.js, no shell) with the prompt on stdin; stream events to a file.
 * Liveness is THIS run's event activity: no output for STALL_MIN minutes is `stalled`, distinct
 * from the wall-clock `timeout`.
 */
export function runCodex(args: string[], cwd: string, prompt: string, eventsPath: string, timeoutMin: number, stallMin: number, onPid: (pid: number) => void): Promise<RunEnd> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CODEX_JS, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    if (child.pid) onPid(child.pid);
    let ended: RunEnd['ended'] = 'exited';
    let rung: RunEnd['rung'];
    let last = Date.now();
    const stop = (why: RunEnd['ended']) => {
      if (ended !== 'exited' || !child.pid) return;
      ended = why;
      console.error(`${why} — reaping codex process tree ${child.pid}`);
      reapTree(child.pid, (r) => { rung = r; });
    };
    const wall = setTimeout(() => stop('timeout'), timeoutMin * 60_000);
    const watch = setInterval(() => { if (Date.now() - last > stallMin * 60_000) stop('stalled'); }, 30_000);
    child.stdout.on('data', (d) => { last = Date.now(); appendFileSync(eventsPath, d); });
    child.stderr.on('data', (d) => appendFileSync(`${eventsPath}.stderr`, d));
    child.stdin.end(prompt); // closes stdin: exec never waits for EOF (trap 1)
    child.on('close', (code) => { clearTimeout(wall); clearInterval(watch); done({ code: code ?? -1, ended, rung }); });
  });
}

