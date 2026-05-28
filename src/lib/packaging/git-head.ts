// Server-only: read the project's current git HEAD commit for skip-if-unchanged.
//
// `git rev-parse HEAD` is run in the project directory. Any failure (not a repo,
// git missing, detached/empty) resolves to null — the caller then builds anyway
// rather than wrongly skipping.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Injectable exec shape — matches `promisify(execFile)` so tests can stub it. */
export type GitExec = (
  file: string,
  args: string[],
  opts: { cwd: string; timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

const SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Resolve the current HEAD sha for `projectPath`, or null when it cannot be
 * determined. `exec` is injectable for testing.
 */
export async function getGitHead(projectPath: string, exec: GitExec = execFileAsync): Promise<string | null> {
  if (!projectPath) return null;
  try {
    const { stdout } = await exec('git', ['rev-parse', 'HEAD'], {
      cwd: projectPath,
      timeout: 10_000,
      maxBuffer: 1024 * 64,
    });
    const sha = stdout.trim();
    return SHA_RE.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/** Short, display-friendly sha (8 chars), or `(none)` for null/empty. */
export function shortSha(sha: string | null, len = 8): string {
  if (!sha) return '(none)';
  return sha.length > len ? sha.slice(0, len) : sha;
}
