/**
 * The session TIMEOUT path itself tree-kills and reports the outcome.
 *
 * `session-tree-kill.test.ts` covers the shared helper; this covers the WIRING —
 * that `spawnClaudeSession`'s timeout routes through it, that the promise still
 * resolves afterwards, and that the result says the session timed out AND what
 * the kill actually did.
 *
 * Nothing is mocked: a `claude` shim is put on PATH that prints its own pid and
 * then hangs, so the session really is spawned through a shell (exactly the
 * `shell: isWindows` shape that orphans the real process), really times out, and
 * the kill is checked against a real OS process tree.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnClaudeSession } from '@/lib/harness/claude-session';

const isWindows = process.platform === 'win32';

const strays: number[] = [];
const tempDirs: string[] = [];
let originalPath: string | undefined;

afterEach(async () => {
  if (originalPath !== undefined) { process.env.PATH = originalPath; originalPath = undefined; }
  for (const pid of strays.splice(0)) {
    if (!isAlive(pid)) continue;
    await new Promise<void>((resolve) => {
      if (isWindows) exec(`taskkill /pid ${pid} /T /F`, () => resolve());
      else { try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ } resolve(); }
    });
  }
  for (const d of tempDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
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

/** Put a hanging `claude` stand-in first on PATH; returns its directory. */
function installClaudeShim(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-shim-'));
  tempDirs.push(dir);
  const inner = `"${process.execPath}" -e "console.log(process.pid); setInterval(()=>{},1000)"`;
  if (isWindows) {
    fs.writeFileSync(path.join(dir, 'claude.cmd'), `@echo off\r\n${inner}\r\n`);
  } else {
    const shim = path.join(dir, 'claude');
    fs.writeFileSync(shim, `#!/bin/sh\nexec ${inner}\n`);
    fs.chmodSync(shim, 0o755);
  }
  originalPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ''}`;
  return dir;
}

describe('spawnClaudeSession timeout', () => {
  it('kills the real session process, resolves, and reports timeout + kill outcome', async () => {
    installClaudeShim();

    const result = await spawnClaudeSession('do the thing', {
      cwd: process.cwd(),
      timeoutMs: 1_000,
      skipPermissions: true,
    });

    // The shim printed the pid of the process doing the "work" — that is what the
    // harness must have killed, NOT just the shell wrapper it can see.
    const innerPid = Number(result.output.trim().match(/(\d+)/)?.[1]);
    expect(Number.isFinite(innerPid)).toBe(true);
    strays.push(innerPid);

    expect(result.timedOut).toBe(true);
    expect(result.errors.some((e) => e.includes('Session timed out after 1000ms'))).toBe(true);
    // The kill outcome travels back with the result instead of being assumed.
    const killLine = result.errors.find((e) => e.startsWith('Timeout kill'));
    expect(killLine).toBeDefined();
    expect(killLine).toContain(isWindows ? 'taskkill' : 'process-group');

    // The regression: under the old `proc.kill('SIGTERM')` this process was still
    // alive at this point — running, and still spending model budget.
    expect(await waitDead(innerPid)).toBe(true);
  }, 30_000);
});
