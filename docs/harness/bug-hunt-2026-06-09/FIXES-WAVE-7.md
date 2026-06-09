# Bug Hunter Fix Wave 7 — Determinism, timestamps & cross-scope integrity

> 4 commits, 4 findings closed (1 critical, 2 high, 1 medium). Remaining determinism/stale-closure findings (item double-produce, weekly-digest timezone, prompt-construction UTC parse, app-shell getTimePeriod) deferred — see "Deferred".
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related RNG / quest / error-memory / session test files 38/38 pass.

## Theme

State that must be reproducible or comparable but wasn't: timestamps whose string format silently diverges, a composite-key update that hits every sibling, a seeded RNG that isn't actually uniform, and a "deterministic" generator that calls `Math.random`. Each fix restores a single canonical, reproducible basis.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `8b7856f` | project-health-insights #4 | critical | `lib/db.ts` |
| 2 | `bb939d8` | prompt-construction-context #1 | high | `lib/error-memory-db.ts`, `app/api/error-memory/route.ts` |
| 3 | `feeada2` | loot-affix-system #1 | high | `lib/seeded-rng.ts` |
| 4 | `6f9fa4d` | world-quests-procgen #4 | medium | `lib/quest-generator.ts` |

## What was fixed

1. **Mixed timestamp formats drop a week of rows** (`8b7856f`). The week digest filters `WHERE completed_at >= ? AND completed_at < ?` with ISO strings (lexicographic), but the `started_at`/`completed_at` columns defaulted to `datetime('now')`, which emits a SPACE-separated value that sorts *below* the `T` of an ISO boundary. Any default-inserted row (a future writer, a backfill, an imported row) would silently fall outside the range and vanish from the week aggregate / daily chart / streaks with no error. Both defaults now use `strftime('%Y-%m-%dT%H:%M:%fZ','now')`, matching `new Date().toISOString()`.
2. **`markResolved` resolved a fingerprint in every module** (`bb939d8`). It ran `UPDATE … WHERE fingerprint = ?` with no `module_id` filter, but fingerprints are module-independent and the table is keyed `UNIQUE(module_id, fingerprint)` — so resolving one module's error dropped that fingerprint's "avoid repeating this" warning from *every other* module's prompts. `markResolved` now takes `moduleId` and filters `WHERE module_id = ? AND fingerprint = ?`; the route requires and passes it.
3. **XORShift32 used a signed shift** (`feeada2`). `createXorShift32RNG` used `s ^= s >> 17`, but the algorithm requires the unsigned `>>>`. The signed shift sign-extends the negative 32-bit state, biasing the stream and shortening its period (masked by the final `>>> 0`) — corrupting every statistic the loot drop simulator and combat sweep compute from it. Changed to `>>>`. Determinism tests still pass (they assert finiteness + same-seed reproducibility, not hardcoded values).
4. **Fetch quests used un-seeded `Math.random`** (`6f9fa4d`). `generateFetchQuests` picked the target room with `Math.random`, breaking the generator's otherwise-pure `(classes, levelDoc) → quests` contract: identical inputs produced different quests, so regenerate-to-compare, regression diffs, and memoization were meaningless. The target is now `explorationRooms[itemIndex % length]`.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors (pre-existing unused-import warnings only) |
| Related tests (loot-drop-simulator, squad-engine, quest-generation-route, ErrorMemoryPanel, SessionAnalyticsDashboard) | 38/38 pass |

## Deferred (not done this wave)

- **item-pipeline-steps #1 — stale-closure double-produce (critical).** A React stale-closure fix in the layout-lab produce flow (functional setState / ref); a UI-state change better exercised against the running app (consistent with deferring the other React optimistic-update fixes).
- **project-health-insights #1 (weekly-digest UTC/local day-key mismatch), #2 (stale regression alerts), prompt-construction UTC-parsed-as-local, app-shell `getTimePeriod` Sunday branch** — a batch of timezone/UTC normalization + React-derivation fixes for a focused follow-up.

## Cumulative status (across all waves)

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| 2 | Atomicity & write races | 3 | 3 | 0 |
| 5 | UE5 codegen correctness | 3 | 1 | 2 |
| 3 | Silent-failure safety gates | 3 | 1 | 1 |
| 7 | Determinism & timestamps | 4 | 1 | 2 |
| **Total** | | **25 / 140** | **14 / 18** | **9 / 70** |

## Patterns established (catalogue items 19–21)

19. **Lexicographic comparison of timestamps requires one canonical format.** A range filter on string timestamps is only correct if every writer (app code AND column defaults / triggers / backfills) emits the exact same shape. Align defaults to the app format, or store epoch-millis and compare numerically.
20. **Mutate a composite-key row with its full key.** A `WHERE` on part of a `UNIQUE(a, b)` key matches every row sharing that part. Thread the whole key (and require it at the API boundary) so a single-row intent can't become a fleet-wide update.
21. **Reproducibility needs a seed and the right bit ops.** A "deterministic" generator must not call `Math.random` (thread an index/seed), and a seeded PRNG must use the algorithm's exact operations (`>>>` for XORShift) — a signed shift quietly biases the whole stream.

## What remains

25 of 140 closed; 14 of 18 criticals. Remaining criticals (4): combat armor squared (logic), crash-analysis substring (logic), item double-produce (React, deferred above), AI-testing FK cascade (schema). Plus the deferred highs/mediums from Waves 2/3/4/5/7 and the timezone batch. A future session resumes from the INDEX + these 7 wave summaries.
