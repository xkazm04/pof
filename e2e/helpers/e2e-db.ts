import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * HERMETIC E2E DATABASE.
 *
 * The Playwright suite drives a REAL Next.js server against REAL SQLite. Until this seam
 * existed that server opened the developer's own `~/.pof/pof.db`, which made the walker's
 * verdict a function of local history: every `judge_verdicts` row, every drain outcome and
 * every artifact any previous session had written fed straight into the acceptance the
 * walker asserted on. A fresh clone and this machine could not agree, and "the walker is
 * red" carried no information about the code under test.
 *
 * `src/lib/db.ts` already honours `POF_DB_PATH` (used by the pof-mcp integration suite), so
 * isolation is just: point the server at a throwaway file and delete it before each run.
 *
 * Note this is ISOLATION, not erasure — the developer's real DB (judge verdicts and all) is
 * untouched; the suite simply stops reading and writing it.
 */

/** Throwaway SQLite file the e2e server runs against. Gitignored, recreated per run. */
export const E2E_DB_PATH = resolve(process.cwd(), 'e2e', '.tmp', 'e2e.db');

/**
 * Delete the throwaway DB (and its WAL/SHM siblings) so every run starts from an empty
 * schema. Called from `playwright.config.ts` at module load — i.e. BEFORE Playwright
 * launches `webServer`, so no process holds the file open.
 */
export function resetE2eDb(): void {
  // playwright.config.ts is re-evaluated inside every worker process, by which time the
  // dev server has the DB open — deleting it there would EPERM (and, on a platform that
  // allowed it, pull the DB out from under the running server mid-suite). Only the runner
  // process (no TEST_WORKER_INDEX) resets.
  if (process.env.TEST_WORKER_INDEX !== undefined) return;
  mkdirSync(dirname(E2E_DB_PATH), { recursive: true });
  for (const f of [E2E_DB_PATH, `${E2E_DB_PATH}-wal`, `${E2E_DB_PATH}-shm`]) {
    if (!existsSync(f)) continue;
    try {
      rmSync(f, { force: true });
    } catch (e) {
      throw new Error(
        `Could not reset the hermetic e2e database at ${f} — a previous dev server is probably ` +
          `still holding it open. Stop it and re-run. (${e instanceof Error ? e.message : String(e)})`,
      );
    }
  }
}
