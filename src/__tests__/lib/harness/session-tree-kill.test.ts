/**
 * A timed-out session is really dead — the orphan-on-Windows fix.
 *
 * `spawnClaudeSession` spawns with `shell: isWindows`, so on Windows `proc.pid`
 * is the wrapping `cmd.exe` and the timeout's `proc.kill('SIGTERM')` reaped the
 * shell while the real `claude -p` kept running — and kept spending — after the
 * harness believed it had stopped it. The dev-server teardown already solved
 * exactly this with a `taskkill /T` tree-kill; both paths now share ONE helper.
 *
 * These tests spawn a real shell-wrapped child that prints its own pid, so the
 * assertions are about an actual OS process tree rather than a mock.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawn, exec, type ChildProcess } from 'child_process';
import {
  killProcessTree,
  killTimedOutSession,
} from '@/lib/harness/claude-session';
import { killDevServer } from '@/lib/harness/orchestrator';

const isWindows = process.platform === 'win32';

/** pids to reap even if a test fails — never kill by name, only by our own pid. */
const strays: number[] = [];

afterEach(async () => {
  for (const pid of strays.splice(0)) {
    if (!isAlive(pid)) continue;
    await new Promise<void>((resolve) => {
      if (isWindows) exec(`taskkill /pid ${pid} /T /F`, () => resolve());
      else { try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ } resolve(); }
    });
  }
});

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitDead(pid: number, timeoutMs = 8_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !isAlive(pid);
}

/**
 * Spawn a long-lived node process THROUGH A SHELL — the same shape as
 * `spawnClaudeSession` on Windows (`claude.cmd` behind `cmd.exe`). Resolves once
 * the inner process has reported its own pid, so the test can check the real
 * work process rather than the shell wrapper.
 */
function spawnShellWrapped(): Promise<{ proc: ChildProcess; innerPid: number }> {
  const command = `"${process.execPath}" -e "console.log(process.pid); setInterval(()=>{},1000)"`;
  const proc = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (proc.pid != null) strays.push(proc.pid);
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('child never reported its pid')), 15_000);
    proc.stdout?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/(\d+)/);
      if (!m) return;
      clearTimeout(timer);
      const innerPid = Number(m[1]);
      strays.push(innerPid);
      resolve({ proc, innerPid });
    });
  });
}

describe('killProcessTree kills the REAL child, not just the shell', () => {
  it('reaps the whole tree of a shell-wrapped spawn', async () => {
    const { proc, innerPid } = await spawnShellWrapped();
    expect(isAlive(innerPid)).toBe(true);

    const outcome = await killProcessTree(proc);

    expect(await waitDead(innerPid)).toBe(true);
    expect(outcome.killed).toBe(true);
    expect(outcome.method).toBe(isWindows ? 'taskkill' : 'process-group');
    expect(outcome.detail).toContain(String(proc.pid));
  }, 30_000);

  it.runIf(isWindows)('CONTROL: the naive proc.kill(SIGTERM) orphans that same child', async () => {
    const { proc, innerPid } = await spawnShellWrapped();

    proc.kill('SIGTERM'); // what the session timeout used to do
    await new Promise((r) => setTimeout(r, 800));

    // The shell is gone but the real work process survives — still running, still
    // spending. This is the defect the tree-kill exists to close.
    expect(isAlive(proc.pid!)).toBe(false);
    expect(isAlive(innerPid)).toBe(true);

    // The helper still finishes the job when handed the (now dead) shell pid?
    // No — that pid is gone, so clean the orphan up explicitly, by pid.
    await new Promise<void>((resolve) => exec(`taskkill /pid ${innerPid} /T /F`, () => resolve()));
    expect(await waitDead(innerPid)).toBe(true);
  }, 30_000);

  it('never throws for a process that has no pid', async () => {
    const fake = { pid: undefined, kill: () => false } as unknown as ChildProcess;
    const outcome = await killProcessTree(fake);
    expect(outcome.method).toBe('none');
    expect(outcome.detail).toContain('no pid');
  });
});

describe('killTimedOutSession states the kill outcome', () => {
  it('records BOTH the timeout and what the kill actually did', async () => {
    const { proc, innerPid } = await spawnShellWrapped();
    const errors: string[] = [];

    const outcome = await killTimedOutSession(proc, 1234, errors);

    expect(await waitDead(innerPid)).toBe(true);
    expect(errors[0]).toBe('Session timed out after 1234ms');
    // The outcome is REPORTED, not assumed — a caller reading `errors` can tell
    // whether the process actually died.
    expect(errors[1]).toContain('Timeout kill');
    expect(errors[1]).toContain(outcome.method);
    expect(errors[1]).toContain(outcome.detail);
    expect(outcome.killed).toBe(true);
  }, 30_000);
});

describe('the dev-server teardown shares the same helper', () => {
  it('tree-kills a shell-spawned dev server and reports the outcome', async () => {
    const { proc, innerPid } = await spawnShellWrapped();

    const outcome = await killDevServer({ proc });

    expect(await waitDead(innerPid)).toBe(true);
    expect(outcome?.killed).toBe(true);
    expect(outcome?.method).toBe(isWindows ? 'taskkill' : 'process-group');
  }, 30_000);

  it('is a no-op when no dev server is running', async () => {
    expect(await killDevServer({ proc: null })).toBeNull();
  });

  it('clears the handle so a second teardown cannot kill a reused pid', async () => {
    const { proc, innerPid } = await spawnShellWrapped();
    const handle = { proc } as { proc: ChildProcess | null };

    await killDevServer(handle);
    expect(handle.proc).toBeNull();
    expect(await waitDead(innerPid)).toBe(true);
    expect(await killDevServer(handle)).toBeNull();
  }, 30_000);
});
