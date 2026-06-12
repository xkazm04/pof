# Bug+UI Scan Fix Wave 2 — Fix-the-fixes (the 06-09 regression tail)

> 7 fix commits (+1 lint chore), 7 findings closed (4 High, 3 Medium-family).
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) → 0; tests **3928 pass / 15 fail / 1 skip** (+3 new tests, all passing; the 15 failures are the same pre-existing set as wave 1).

Every finding in this wave is a fix from the 2026-06-09 bug-hunt that was *right but partial* — applied to one call site while its twins kept the bug, or written where it can't reach existing state.

## Commits

| # | Commit | Finding closed | Original fix it completes |
|---|---|---|---|
| 1 | `2f4c518` | crash-analysis #1 — multi-word trigger keywords never match; guardrail silently dead | 25d6de5 (whole-word matching) |
| 2 | `6ecfe53` | layout-lab #1 — ArchetypeStep kept the stale-closure batch drop | 3d50330 (`produceFrom`, migrated only ItemArt) |
| 3 | `dc19c56` | economy #1 — `generate-code` + `/sweep` still fed raw configs to the engine | the 06-09 `clampConfigInt` (landed only on `simulate`) |
| 4 | `3c70199` | module-registry #1 — Auto-Verify batch write 500s deterministically; feature dead behind a success banner | 2dd1e06 (`writeResult.ok` gate made the dead write *visible* as dead events) |
| 5 | `c9374c3` | harness #3 — checkpoint baseline at bare HEAD wipes pre-run uncommitted work on first rollback | 73a447a (fixed concurrency, not the dirty-tree anchor) |
| 6 | `c7fa2a6` | session-analytics #1 — ISO timestamp defaults inert on every existing DB | 8b7856f (defaults inside `CREATE TABLE IF NOT EXISTS`) |
| 7 | `f934a89` | gdd #3 — quality-star `.repeat()` still unclamped; one bad row kills GDD + exports | the 06-09 room-difficulty clamp |

## What was fixed (one mental model: a fix must cover every site/state the bug lives in)

1. **Keyword matcher** — phrase keywords (`'state machine'`, `'base class'`, most APPROACH_KEYWORDS) now match when all their tokens appear; light trailing-s stemming on both sides. Regression test added: the textbook state-machine prompt triggers the state-machine anti-pattern.
2. **ArchetypeStep** — `generate`/`reselect` derive seq/batches/selection from live store data inside `produceFrom`, exactly like ItemArt.
3. **Economy config** — clamping moved into one exported `normalizeSimulationConfig` (`src/lib/economy/normalize-config.ts`) used by `simulate`, `generate-code`, and `/sweep`; sweep `range` clamped to [0.05, 0.9].
4. **Auto-Verify** — updates merged from already-fetched rows into complete upsert rows; the POST rejects partial rows with an actionable 400; failed writes surface as `writeError` and the banner renders "write failed — statuses NOT saved".
5. **Checkpoint baseline** — a dirty tree is committed on the harness branch as the real baseline; if the snapshot can't be committed, checkpointing is refused entirely. Two tests added. *Deferred residual:* the run still ends on `harness/<runId>` — branch restore belongs to the epilogue fix (harness finding #1, theme G/H).
6. **session_analytics** — startup migration rebuilds tables still carrying `datetime('now')` defaults (the `feature_matrix_new` pattern) and normalizes legacy space-format rows. Verified by an in-memory legacy-DB simulation: rows normalize, fresh defaults emit `T…Z`, idempotent.
7. **GDD meters** — one clamped `meter(value, max, full, empty)` helper now feeds all three meter-style `.repeat` sites (quality stars, room difficulty, progress bar).

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (per-fix and at wave end) |
| `eslint` (all changed files) | 0 problems (incl. fixing a pre-existing `no-require-imports` in the touched test) |
| `vitest run` (full suite) | 3928 pass / 15 fail / 1 skip — failures identical to the wave-1 pre-existing set (ChartPanel flake, user's uncommitted `leonardo.ts`, 13× ueStaticCheckers/catalog test-env) |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| **Total** | | **13 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 31–34)

31. **A fix is finished when every twin call site is migrated.** Grep for the pattern you just fixed (`produce(`, `Math.min(... ?? `, `.repeat(`) before closing — three of this wave's seven bugs were "the fix landed on one of N copies."
32. **Schema-default fixes don't reach existing databases.** Anything inside `CREATE TABLE IF NOT EXISTS` is fresh-install-only; pair every default/constraint change with a `sqlite_master`-guarded rebuild migration (the `feature_matrix_new` pattern).
33. **Tokenize both sides of a word-boundary match.** Whole-word matching against a Set of single tokens silently kills every multi-word keyword; phrases need an all-tokens (or n-gram) path and the denominator must only count matchable entries.
34. **A rollback anchor must be a state the working tree actually had.** Recording bare HEAD as "last good" on a dirty tree arms a destroyer; snapshot the dirty state first or refuse to arm the rollback.

## What remains

323 → 310 open findings. Next suggested wave: **D — destructive writes & data loss** (6: genome name-clear delete, populate-demo history wipe, auto-seed overwrite, eval baseline wipe, audio catalog wipe on tab switch, stale create-CTA scaffold-over). Then C — UE5 codegen correctness (4–6).
