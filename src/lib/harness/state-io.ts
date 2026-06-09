/**
 * Shared JSON state-file I/O for the harness.
 *
 * The harness persists its plan / progress / cost / checkpoint ledger / guide
 * as pretty-printed JSON sidecar files under a run's `.harness` state dir. These
 * two helpers centralise the read-with-fallback and write boilerplate that was
 * previously copy-pasted across `orchestrator.ts` and `guide-generator.ts`, so
 * the persistence contract lives in one place — the single spot to harden later
 * with atomic writes or logging.
 *
 * Note: writes are *not* swallowed here. Callers that want best-effort writes
 * (the checkpoint ledger, the cost ledger) wrap the call in their own try/catch;
 * callers that treat a failed write as fatal (plan, progress, guide) let it throw.
 */

import * as fs from 'fs';

/**
 * Read and JSON-parse `filePath`, returning `fallback` when the file is missing
 * or unparseable. Never throws — a missing or corrupt state file degrades to the
 * fallback rather than crashing the loop.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

/** Pretty-print `data` as JSON to `filePath` (2-space indent). Throws on write failure. */
export function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
