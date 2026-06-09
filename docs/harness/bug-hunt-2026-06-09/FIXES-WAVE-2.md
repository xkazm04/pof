# Bug Hunter Fix Wave 2 — Atomicity & write races

> 3 commits, 3 critical findings closed. Remaining Wave-2 highs (idempotency check-then-act, audio scene lost-update, pipeline applyLifecycle rollback) deferred — see "Deferred".
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related prompt-evolution + store test files 31/31 pass.

## Theme

Database writes that must agree with each other but weren't made atomic: a multi-table mutation with no transaction, a counter incremented via a stale JS snapshot, and one column written by two writers with no merge. Each fix moves the atomicity into the database (transaction / `x = x + 1` / merge-in-transaction) so the corruption is impossible regardless of timing.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `1f51224` | game-director-regression #1 | critical | `lib/regression-tracker.ts` |
| 2 | `ae32fa0` | prompt-evolution-a-b-testing #1 | critical | `lib/prompt-evolution/evolution-db.ts`, `…/engine.ts` |
| 3 | `baffff5` | module-registry-feature-matrix #1 | critical | `app/api/project-progress/route.ts` |

## What was fixed

1. **regression-tracker — non-atomic multi-table write** (`1f51224`). `processSession` issued INSERTs/UPDATEs across `regression_fingerprints`, `_occurrences`, and `_alerts` plus a final "mark fixed" sweep, all bare (the sibling writes in `game-director-db` use `db.transaction`). A mid-loop failure left `occurrence_count`, the occurrence rows, and fingerprint status disagreeing — silently corrupting the cross-session regression history. The whole body now runs inside `db.transaction`, committing atomically or rolling back on any throw.
2. **prompt-evolution — A/B trial lost update** (`ae32fa0`). `recordTestTrial` read the whole test row, added 1 in JS, and wrote the whole row back, so two concurrent trials reading the same snapshot each wrote the same `+1` and one real trial vanished — skewing which variant `evaluateTest` declares the winner. New `recordTrialAndEvaluate` does the increment in SQL (`col = col + 1`), then re-reads, evaluates, and persists the verdict, all in one transaction; `engine.recordTestTrial` delegates to it. (Column names come from a fixed A/B branch — no user input in the SQL identifiers.)
3. **project-progress — checklist last-writer-wins** (`baffff5`). The store autosaves the whole `checklist_json` blob from its stale client snapshot on every toggle, while the CLI marks items complete out-of-band via `/api/checklist/complete`; the blind `ON CONFLICT` overwrite dropped any CLI completion the client never saw. The POST now reads the stored checklist and merges the incoming one over it per `(module, item)` inside a transaction — keys the client doesn't send are preserved, keys it does send win.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors |
| Related tests (prompt-evolution engine + db, version timeline, projectStore) | 31/31 pass — atomic recordTrialAndEvaluate is behavior-compatible |

## Deferred (not done this wave)

- **session-analytics-telemetry #1 — idempotency check-then-act (high).** Server-side DB fix, a good next-wave candidate; left out to keep this wave to the 3 criticals.
- **audio-generation-scenes #2 — scene edit lost-update (high)** and **pipeline-artifacts-test-gates — `applyLifecycle` no rollback.** Both are React optimistic-update refactors (touching the generic `useCRUD` hook / painter event flow), larger and UI-risky; better suited to a dedicated UI-state wave that can be exercised in the running app.

## Cumulative status (across waves so far)

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| 2 | Atomicity & write races | 3 | 3 | 0 |
| **Total** | | **15 / 140** | **11 / 18** | **4 / 70** |

## Patterns established (catalogue items 10–12)

10. **Dependent multi-statement DB writes belong in one transaction.** If three tables must agree (count ↔ rows ↔ status), a bare sequence corrupts on any partial failure. `db.transaction(() => {...})()` (synchronous in better-sqlite3) makes the half-applied state impossible.
11. **Increment in SQL, never via a JS snapshot.** `read → +1 in JS → write whole row` is a lost-update race; `UPDATE … SET x = x + 1 WHERE id = ?` is atomic. Derive any decision from a fresh re-read inside the same transaction.
12. **Two writers on one column need a merge or a version check, not a blind overwrite.** When a client autosaves a whole blob that a server process also mutates out-of-band, overwrite = silent data loss. Merge per-key server-side (preserve keys the writer didn't touch) or add an `updated_at` compare-and-swap.

## What remains

15 of 140 closed; 11 of 18 criticals. Remaining criticals (7): combat armor squared, crash-analysis substring, item double-produce, quest dangling node, AI-testing FK cascade, project-health timestamp, build/cook sizeBytes — spread across Wave 3 (silent-failure gates), Wave 5 (UE5 codegen correctness), Wave 7 (determinism / timestamps / stale closures). Plus the deferred Wave-2 highs and the Wave-4 UE5 connection-manager high.
