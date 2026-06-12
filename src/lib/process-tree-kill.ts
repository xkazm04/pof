import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

/**
 * Kill a spawned process AND all of its descendants.
 *
 * On Windows, `ChildProcess.kill()` calls TerminateProcess on the tracked PID
 * only. When the child was spawned with `shell: true` (or via a `.cmd` shim,
 * or is a launcher like UAT/UBT), that PID is a wrapper — the real workers
 * (node.exe, UnrealEditor-Cmd.exe, MSBuild/cl.exe…) are grandchildren and
 * survive the kill, keeping file locks, editing files, and burning tokens.
 * `taskkill /T /F` walks the whole tree.
 *
 * On POSIX `kill()` of the direct child is used; callers needing
 * process-group semantics there should spawn detached and signal the group.
 */
export function killProcessTree(
  proc: ChildProcess | null | undefined,
  signal: NodeJS.Signals = 'SIGTERM'
): boolean {
  if (!proc || proc.pid === undefined || proc.pid === null) return false;
  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      // taskkill itself failing to launch must not leave the tree alive.
      killer.on('error', () => {
        try { proc.kill(signal); } catch { /* already gone */ }
      });
      return true;
    } catch {
      // fall through to the plain kill below
    }
  }
  try {
    return proc.kill(signal);
  } catch {
    return false;
  }
}
