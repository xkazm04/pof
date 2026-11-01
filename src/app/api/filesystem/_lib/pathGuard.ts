/**
 * The one input guard for every `/api/filesystem/*` route.
 *
 * These routes are local-machine readers: the project path is client state (the operator
 * may pick any directory), so there is no server-side project root to confine a path to.
 * What CAN be refused is every path shape that reaches something other than a local
 * directory, and every segment that walks out of the directory a route meant to read:
 *
 *  - UNC and device paths (`\\server\share`, `//server/share`, `\\?\…`, `\\.\…`). On
 *    Windows a bare `fs.stat` on a UNC path opens an SMB session and offers the user's
 *    NTLM credentials to that host, so one request naming `\\attacker\x` leaks a hash.
 *  - Drive-relative paths (`C:foo`), which resolve against a per-drive cwd nobody chose.
 *  - Relative paths, which resolve against the server's cwd.
 *  - NUL bytes and absurd lengths.
 *
 * `checkModuleName` confines `Source/<moduleName>` to one directory under `Source/`:
 * a UE module name is a C++ identifier, so `..`, separators and drive letters never pass.
 */
import os from 'os';
import path from 'path';
import { err, ok, type Result } from '@/types/result';

/** Longer than any real Windows long path a project would use, short enough to refuse junk. */
export const MAX_PATH_LENGTH = 1024;

const UNC_OR_DEVICE = /^[\\/]{2}/;
const DRIVE_RELATIVE = /^[A-Za-z]:(?![\\/])/;
const DRIVE_ABSOLUTE = /^[A-Za-z]:[\\/]/;
/** A UE module name: a C++ identifier (UBT refuses anything else). */
const UE_MODULE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function expandHome(input: string): string {
  if (input === '~' || input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

/**
 * Validate a caller-supplied local directory path and return it normalized.
 * `expandHome` lets `~` mean the server user's home (the browse picker's convenience).
 */
export function checkLocalPath(
  input: unknown,
  field = 'path',
  opts: { expandHome?: boolean } = {},
): Result<string, string> {
  if (typeof input !== 'string' || input.trim() === '') return err(`${field} is required`);
  if (input.length > MAX_PATH_LENGTH) return err(`${field} exceeds ${MAX_PATH_LENGTH} characters`);
  if (input.includes('\0')) return err(`${field} contains a NUL byte`);

  const raw = opts.expandHome ? expandHome(input.trim()) : input.trim();
  if (UNC_OR_DEVICE.test(raw)) {
    return err(`${field} must be a local path; UNC and device paths (\\\\server\\share, \\\\?\\, \\\\.\\) are refused`);
  }
  if (DRIVE_RELATIVE.test(raw)) return err(`${field} must be absolute; a drive-relative path (C:foo) is refused`);
  if (!path.isAbsolute(raw) && !DRIVE_ABSOLUTE.test(raw)) return err(`${field} must be an absolute path`);

  const normalized = path.normalize(raw);
  // Normalization never invents a UNC prefix today; re-check so it never can.
  if (UNC_OR_DEVICE.test(normalized)) return err(`${field} must be a local path`);
  return ok(normalized);
}

/** Validate a UE module name so `Source/<moduleName>` cannot leave `Source/`. */
export function checkModuleName(input: unknown, field = 'moduleName'): Result<string, string> {
  if (typeof input !== 'string' || input === '') return err(`${field} is required`);
  if (!UE_MODULE_NAME.test(input)) {
    return err(`${field} must be a UE module name (letters, digits, underscore; no path segments)`);
  }
  return ok(input);
}
