/**
 * Shared JSON state-file I/O for the harness.
 *
 * The harness persists its plan / progress / cost / checkpoint ledger / guide
 * as pretty-printed JSON sidecar files under a run's `.harness` state dir. These
 * helpers centralise the read and write boilerplate that was previously
 * copy-pasted across `orchestrator.ts` and `guide-generator.ts`, so the
 * persistence contract lives in one place.
 *
 * Two properties this module is responsible for:
 *
 * 1. **Writes are atomic** — a state file is written to a sibling temp file and
 *    `rename`d over the target, so a crash (or a concurrently reading process)
 *    can never observe a half-written file. A plain `writeFileSync` could
 *    truncate `game-plan.json` mid-write, and because the read path degrades to
 *    a fallback, the next run would silently REBUILD the plan and discard every
 *    completed area rather than failing.
 * 2. **Corruption is never silent** — `readJsonFileState` distinguishes
 *    `missing` (first run: the fallback is correct) from `corrupt` (a real file
 *    that will not parse: the fallback is a LIE). `readJsonFile` keeps its
 *    never-throw contract for best-effort callers but logs corruption loudly;
 *    callers holding work that a fallback would destroy use
 *    `readJsonFileStrict` and stop.
 *
 * Note: writes are *not* swallowed here. Callers that want best-effort writes
 * (the checkpoint ledger, the cost ledger) wrap the call in their own try/catch;
 * callers that treat a failed write as fatal (plan, progress, guide) let it throw.
 */

import * as fs from 'fs';
import { logger } from '@/lib/logger';

// ── Reads ────────────────────────────────────────────────────────────────────

/** Why a state read produced what it produced. `corrupt` must never read as `missing`. */
export type JsonFileState = 'ok' | 'missing' | 'corrupt';

export interface JsonFileRead<T> {
  /** `ok` — parsed. `missing` — no such file (first run). `corrupt` — present but unusable. */
  state: JsonFileState;
  /** The parsed value, or `fallback` for `missing` / `corrupt`. */
  value: T;
  /** Failure detail for `corrupt` (parse or read error message). */
  error?: string;
}

/** Thrown by {@link readJsonFileStrict} when a state file exists but cannot be parsed. */
export class StateFileCorruptError extends Error {
  constructor(readonly filePath: string, readonly detail: string) {
    super(`Harness state file CORRUPT: ${filePath} — ${detail}`);
    this.name = 'StateFileCorruptError';
  }
}

/**
 * Read and JSON-parse `filePath`, reporting WHY the result is what it is.
 * A missing file is `missing` (the fallback is legitimately correct); a file
 * that exists but will not parse is `corrupt` — the case a plain fallback would
 * paper over, silently discarding whatever the file was holding.
 */
export function readJsonFileState<T>(filePath: string, fallback: T): JsonFileRead<T> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return { state: 'missing', value: fallback };
    // Present but unreadable (permissions, a directory, a locked file) — that is
    // NOT "no state yet"; treating it as such is exactly the silent-restart bug.
    return { state: 'corrupt', value: fallback, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { state: 'ok', value: JSON.parse(raw) as T };
  } catch (err) {
    return {
      state: 'corrupt',
      value: fallback,
      error: `${err instanceof Error ? err.message : String(err)} (${raw.length} bytes on disk)`,
    };
  }
}

/**
 * Read and JSON-parse `filePath`, returning `fallback` when the file is missing
 * or unparseable. Never throws — a best-effort caller degrades to the fallback
 * rather than crashing the loop — but a CORRUPT file is logged loudly so it can
 * never pass for "no state yet" in the logs either.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  const read = readJsonFileState<T>(filePath, fallback);
  if (read.state === 'corrupt') {
    logger.error(
      `[harness] State file CORRUPT: ${filePath} — ${read.error}. Falling back to the default value; `
      + 'anything the file was holding is NOT being used.',
    );
  }
  return read.value;
}

/**
 * Like {@link readJsonFile}, but THROWS {@link StateFileCorruptError} when the
 * file exists and cannot be parsed. Use this wherever the fallback would destroy
 * work — e.g. a corrupt `game-plan.json` read as `null` makes the loop rebuild
 * the plan from scratch and abandon every completed area. A missing file still
 * returns the fallback: first run must work.
 */
export function readJsonFileStrict<T>(filePath: string, fallback: T): T {
  const read = readJsonFileState<T>(filePath, fallback);
  if (read.state === 'corrupt') throw new StateFileCorruptError(filePath, read.error ?? 'unparseable');
  return read.value;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Monotonic suffix so two writes in the same millisecond cannot share a temp name. */
let tempSeq = 0;

/** Best-effort synchronous pause between rename attempts (Windows AV/indexers hold brief locks). */
function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch { /* no SharedArrayBuffer — retry immediately rather than not at all */ }
}

/**
 * Pretty-print `data` as JSON to `filePath` (2-space indent), ATOMICALLY.
 *
 * The payload goes to a sibling `.tmp-*` file which is fsync'd and then renamed
 * over the target: a reader either sees the previous complete file or the new
 * complete file, never a truncated one. Serialization happens BEFORE the target
 * is touched, so a value that cannot be stringified (a cycle) leaves the
 * existing state file intact instead of destroying it.
 *
 * Throws on write failure (the pre-existing contract) and leaves no temp residue.
 */
export function writeJsonFile(filePath: string, data: unknown): void {
  // Serialize first — a throw here must not have touched the target file.
  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid.toString(36)}-${Date.now().toString(36)}-${(tempSeq++).toString(36)}`;

  let fd: number | undefined;
  try {
    fd = fs.openSync(tmpPath, 'w');
    fs.writeFileSync(fd, json);
    // Flush to disk before the rename so a power loss cannot leave a renamed but
    // empty file. Not every filesystem supports it; the rename is the atomicity
    // guarantee either way.
    try { fs.fsyncSync(fd); } catch { /* fsync unsupported — rename still atomic */ }
    fs.closeSync(fd);
    fd = undefined;

    // `rename` replaces the destination atomically on POSIX and on Windows
    // (MoveFileEx + MOVEFILE_REPLACE_EXISTING). A transient Windows lock is
    // retried briefly rather than surfacing as a spurious state-write failure.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) sleepSync(15);
      }
    }
    throw lastErr;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
    // Only ever removes the temp file — the target is never unlinked here.
    if (fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch { /* ignore */ } }
  }
}
