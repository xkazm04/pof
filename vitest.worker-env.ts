/**
 * Per-worker test database. Listed FIRST in `setupFiles`, so it runs before
 * `src/__tests__/setup.ts` and before the test file's own imports — `src/lib/db.ts` reads
 * `POF_DB_PATH` when it loads, and nothing in this worker has loaded it yet.
 *
 * `vitest.config.ts` seeds `test.env.POF_DB_PATH` with one path per run (`testDbPath()`), the
 * containment floor that keeps the operator's real `~/.pof/pof.db` untouched. Left alone, every
 * parallel worker would share that one SQLite file: concurrent first-open bootstraps contend for
 * the write lock, and one file's rows land in another file's `listX(limit)` reads. Suffixing the
 * vitest pool id gives each worker its own file while the floor stays in force.
 *
 * Only a path still equal to the floor is rewritten — a test that overrode it (`vi.hoisted`)
 * runs later and keeps winning.
 */
// Deliberately no import of `vitest.global-setup` (it pulls in better-sqlite3 and child_process,
// and this file runs in every worker). Its `runDbFiles()` sweeps the `-w<pool>` files named here.
const floor = process.env.POF_DB_PATH;
const poolId = process.env.VITEST_POOL_ID;
if (floor && poolId) process.env.POF_DB_PATH = floor.replace(/\.db$/, `-w${poolId}.db`);
