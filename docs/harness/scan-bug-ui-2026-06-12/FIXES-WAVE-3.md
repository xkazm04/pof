# Bug+UI Scan Fix Wave 3 — Destructive writes & data loss

> 6 commits, 6 High findings closed.
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0; tests 3928 pass / 15 fail / 1 skip (all pre-existing).

One mental model: **a write path must never trust transient UI state, a failed read, or "in scope" as permission to destroy persisted work.** Guard the write (skip/merge/default/insert-if-missing), don't sanitize-by-deletion.

## Commits

| # | Commit | Finding closed | Data that was being destroyed |
|---|---|---|---|
| 1 | `f962d7c` | genome #2 — empty name deletes the genome + checkpoints on reload | hand-tuned genome + its full checkpoint history |
| 2 | `30630e6` | item-pipeline #1 — Populate demo wipes kept generation history (synced to server) | every kept batch/candidate/direction/prompt of 3 generative steps |
| 3 | `00c0f36` | module-registry #2 — auto-seed after a failed GET overwrites review data | a whole module's statuses/scores/notes/paths |
| 4 | `9923232` | quality-eval #3 — errored-pass modules wipe the regression baseline as fake "Resolved" | the regression baseline + true finding history |
| 5 | `7b889d2` | audio #2 — Event Catalog edits wiped on every tab switch | the curated event catalog (events/triggers/priorities/tags) |
| 6 | `e104836` | project-setup #1 — stale Create-project CTA scaffolds over an existing project | a fully-built UE project's .uproject/Source/GameMode |

## What was fixed

1. **Genome sanitizer repairs instead of deletes.** A present-but-empty `name` (the header input persists `''` on every keystroke mid-rename) is now defaulted to "Unnamed Archetype" with a warning; only a *missing* name key still rejects. The header input also defaults on blur so an empty name is never left persisted.
2. **Populate demo fills gaps only.** `populateItemDemo` skips steps that already have an artifact (predicate against live store state). Residual cosmetic note: on a fresh entity the demo's `{selected: 0}` still passes the Icon acceptance while the gallery is empty — inconsistent copy, no data loss.
3. **Auto-seed double-guarded.** The seed effect requires a *successful* empty fetch (`!error`), and seed writes go through a new `seedOnly` insert-if-missing mode (`ON CONFLICT DO NOTHING`) — either guard alone prevents the wipe.
4. **"In scope" now means "successfully evaluated."** `DeepEvalResult.failedModules` (any pass errored/never ran) is excluded from the baseline-merge/diff scope, and the results view says "N modules failed to evaluate — excluded from the baseline" instead of celebrating false RESOLVEDs.
5. **Event Catalog persisted.** A persisted zustand store (`audioEventCatalogStore`, null until first edit) seeds the component and receives write-through on every change — survives tab switches *and* reloads.
6. **Project scan keyed by path.** The once-per-lifetime boolean ref became a scanned-*path* ref: still StrictMode-safe, but switching projects schedules a fresh scan, so the NextStepBanner can no longer offer "Create project" against a fully-built repo.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (per-fix and at wave end; one stale-incremental near-miss caught by hand — see patterns) |
| `eslint` (all 12 changed files) | 0 problems |
| `vitest run` (full suite) | **3928 pass / 15 fail / 1 skip** — identical to the wave-2 verification; all 15 failures pre-existing (ChartPanel flake, user's uncommitted `leonardo.ts`, 13× ueStaticCheckers/catalog test-env) |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| 3 | Destructive writes & data loss | 6 | 0 |
| **Total** | | **19 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 35–38)

35. **Repair, don't delete, on rehydrate.** A sanitizer that drops "invalid" persisted entries turns every transient editor state the app itself can write (empty name mid-rename) into permanent data loss. Default recoverable fields; reserve rejection for structurally-foreign input.
36. **Demo/seed writers must be insert-if-missing.** Any "populate/seed" path that reuses a full-overwrite upsert will eventually run against real data (failed fetch, re-click, stale guard). `ON CONFLICT DO NOTHING` or a skip-existing predicate is one line.
37. **"Fetch failed" ≠ "empty".** Both leave a list state at `[]`; any effect that writes based on emptiness must also check the error channel.
38. **Module-scope results need per-module success.** A batch operation that reports only batch-level status invites consumers to treat per-item absence as per-item truth ("no findings = clean"). Return the failed-item list and exclude it from downstream merges.

## What remains

323 → 304 open findings. Next suggested waves: **C — UE5 codegen correctness** (cooldown→Period semantics, float literals, identifier linting, dry-run diff contract) or **E — queues & races** (Blender queue flush/drain, forge poll, inventory re-key, harness pool).
