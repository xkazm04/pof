/**
 * Temp dirs a test file creates, removed when the file finishes.
 *
 * `makeTempDir(prefix)` is `fs.mkdtempSync(join(os.tmpdir(), prefix))` plus a registration; the
 * hook at the bottom of this module is registered when a test file imports it, so a file needs no
 * `afterAll` of its own. Anything that HOLDS files in the dir (a SQLite handle, a child process)
 * must be closed in the test file's own `afterAll`: hooks run last-registered-first, so that hook
 * runs before this removal.
 *
 * Set KEEP_TMP=1 to keep the dirs for debugging.
 */
import { afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const made = new Set<string>();

/** Register a dir this test file created (or owns) for removal after the file's last test. */
export function trackTempDir(dir: string): string {
  made.add(dir);
  return dir;
}

/** Create a unique dir under the OS temp dir and register it for removal. */
export function makeTempDir(prefix: string): string {
  return trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** Names and sizes of every file under `dir`, for `waitForQuiet`. */
function treeFingerprint(dir: string): string {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { out.push(`${p}:${fs.statSync(p).size}`); } catch { /* raced away */ } }
    }
  };
  walk(dir);
  return out.sort().join('|');
}

/**
 * Wait until nothing under `dir` has been created or grown for `quietMs`. For code that opens
 * a write stream whose `open` lands a tick later (the CLI service's per-execution log): removing the
 * dir before that open completes makes it fail with ENOENT as an unhandled error.
 */
export async function waitForQuiet(dir: string, quietMs = 200, maxMs = 5000): Promise<void> {
  const deadline = Date.now() + maxMs;
  let last = treeFingerprint(dir);
  let since = Date.now();
  while (Date.now() < deadline && Date.now() - since < quietMs) {
    await new Promise((r) => setTimeout(r, 25));
    const now = treeFingerprint(dir);
    if (now !== last) { last = now; since = Date.now(); }
  }
}

/** Remove every registered dir. `rmSync` never follows a link out of the dir. */
export function removeTempDirs(): void {
  if (process.env.KEEP_TMP === '1') return;
  for (const dir of made) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (e) {
      console.error(`[temp-dirs] could not remove ${dir}: ${(e as Error).message}`);
    }
  }
  made.clear();
}

afterAll(removeTempDirs);
