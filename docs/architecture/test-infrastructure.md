# Test infrastructure — decision record

Three decisions landed on `master` on 2026-10-05 to make the full vitest suite green and repeatable
(13526 pass / 0 fail twice running with a clean tree, per `.claude/fleet-memory.md`). Until this doc they lived only in code comments
and one fleet-memory line. Each section: context → decision → consequences → the rule a session must follow.

Sources of truth: `vitest.config.ts`, `vitest.worker-env.ts`, `vitest.global-setup.ts`, `.gitattributes`.
The timeout rule is enforced by `src/__tests__/infra/no-sub-budget-test-timeouts.test.ts`.

## 1. One SQLite file per test worker — `26330a1a`

**Context.** `src/lib/db.ts` reads `POF_DB_PATH || ~/.pof/pof.db`. Opting in per test was not enough: on 2026-08-19 the
operator's real DB held 344 `pipeline_artifacts` rows of synthetic entities (about 42% of the table), so `2b8c96b0` added a
containment floor — `test.env.POF_DB_PATH = testDbPath()` (one file per vitest process, `pof-test-<pid>.db` under the OS temp dir)
plus a guard in `vitest.global-setup.ts` that fails the run if fixture rows reach `~/.pof/pof.db` anyway. That floor was keyed by
the vitest main pid only, so every parallel worker in one run shared one SQLite file: concurrent first-open bootstraps
contended for the write lock, and one file's rows landed in another file's `listX(limit)` reads.

**Decision.** `vitest.worker-env.ts` is the first `setupFiles` entry (it runs before `src/__tests__/setup.ts` and before the test
file's own imports, so before `db.ts` loads). It rewrites `POF_DB_PATH` from `…/pof-test-<pid>.db` to `…/pof-test-<pid>-w<VITEST_POOL_ID>.db`.
Only a path still equal to the floor is rewritten, so a test with its own `vi.hoisted` override keeps winning. The floor and the
real-DB guard stay. The global setup deletes the floor file and every `-w<pool>` file (and `-wal`/`-shm` sidecars) at start and end.

**Consequences.**
- Rows written by one test file are visible to other files that ran in the *same worker* (a pool slot's file is reused across the
  files it runs in turn), never to other workers. Do not rely on an empty DB at file start unless the suite resets it.
- `vitest.worker-env.ts` deliberately does not import `vitest.global-setup` (it pulls in better-sqlite3 and `child_process`, and
  the file runs in every worker); the sweep of `-w` files lives in global setup.

**Rules.**
- Never share one SQLite file across workers.
- Never point a test at `~/.pof/pof.db` — not directly, not by overriding `POF_DB_PATH` to the real path. The global-setup guard
  fails the whole run, naming the drift, if a synthetic fixture row reaches it. Do not delete the guard.

## 2. A 60 s global test and hook budget — `26330a1a`, `189c5694`, `05af1100`

**Context.** vitest's 5 s default fails slow-but-correct tests only under full-suite load (a synchronous `src/` walk, a first DB
bootstrap, LayoutLab renders). `26330a1a` first set `testTimeout`/`hookTimeout` to 30 s. `LayoutLab.navigation` "consumes a matrix
jump" takes ~12 s solo and still timed out at its own 20 s per-file override under load, so `189c5694` raised the global budget to
60 s and `05af1100` removed the four LayoutLab files' 20 s overrides (those files had claimed to pass "well under 1 s solo").

**Decision.** `vitest.config.ts` sets `testTimeout: 60_000` and `hookTimeout: 60_000`. 60 s still fails a real hang inside a minute.

**Consequences.**
- A per-suite or per-test timeout below 60 s *overrides* the global one and re-introduces the flake: a "tight" timeout passes on
  an idle laptop and fails on 16 busy workers. `testTimeout` set through `vi.setConfig` does the same.
- A genuinely hung test now takes up to a minute to fail instead of 5 s.
- Values of 60 s or more (e.g. the `120_000` perf-capture tests, the live-API tests) are allowed — they widen the budget.
- Wait budgets are separate and untouched: `findBy*`, `waitFor` and `vi.waitFor` `{ timeout }` options say how long to poll, not how long
  the test may run; likewise a `timeout:` inside a test body (a `spawnSync` option, a product option) is not a test budget.
- On 2026-10-06 the tree still had 30 sub-60 s overrides in `src/__tests__` (6 `describe` options, 2 `vi.setConfig`, 22 trailing
  per-test numbers). They were removed, and `no-sub-budget-test-timeouts.test.ts` now fails, naming `file:line`, on any new one.

**Rules.**
- Never set a per-suite or per-test timeout under 60 s (`describe`/`it`/`test` options or trailing number, `vi.setConfig`).
  If a test is slow, let it inherit the budget; if a test's own timeout is the thing under test, add it to the guard's
  commented `ALLOWLIST` with a reason (it is empty today).
- Do not lower the values in `vitest.config.ts`.

## 3. Snapshots stay LF — `cd748e73`

**Context.** vitest serialises snapshots with LF and rewrites any `.snap` whose line endings differ. With `core.autocrlf=true`
a checkout wrote CRLF, so a full run dirtied `ue-gotchas`, `ue-known-assets` and `combat-wiring-contracts` `.snap` files. There was
no `.gitattributes` at all; `5c19c5f9` had inlined the fix per file.

**Decision.** One root rule in `.gitattributes`: `*.snap text eol=lf`, replacing per-file inlining.

**Consequences.** A test run no longer dirties the tree on a CRLF-configured checkout. Only `*.snap` is pinned — source files
still follow `core.autocrlf` (git will warn about LF→CRLF on them; that is expected).

**Rule.** `*.snap` stays LF. Never remove or narrow the rule, and never commit a CRLF snapshot.

## Recording a new test-infra decision

Add a section here (context with commit SHAs, decision, consequences, rule) and one `DECISION` line to `.claude/fleet-memory.md`.
