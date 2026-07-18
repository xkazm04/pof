# Bug+UI Scan Fix Wave 3 — High-Severity Concurrency / Stale-Response Races

> 5 commits, 10 High-severity findings closed across 9 files.
> The dominant scan theme (theme A: concurrent-invocation / stale-response races) — one fix pattern applied everywhere.

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `18629ee7` fix(cli-tasks): synchronous re-entrancy latch + heartbeat resume | cli-terminal-task-system #2, #3 | useTaskQueue.ts |
| 2 | `e08ac52f` fix(authoring): re-entrancy latches on wizard + catalog dispatch | character-genome-designer #1, inventory-system #1 | CharacterSourceWizard.tsx, CatalogGearTab.tsx |
| 3 | `2aa09187` fix(app-shell): sequence global-search + reset index guard | app-shell-navigation (2 High) | GlobalSearchPanel/useGlobalSearchPanel.ts |
| 4 | `6988aeb1` fix(module-registry,prompt-evolution): sequence module-switch fetches | module-registry-feature-matrix #1, prompt-evolution #1 | useFeatureMatrix.ts, promptEvolutionStore.ts |
| 5 | `becd3acc` fix(bridge,preflight,path-browser): guard stale async results | ue5-bridge #1, build-cook-packaging #1, project-setup #2 | usePofBridge.ts, PreflightPanel.tsx, PathBrowser/usePathBrowser.ts |

## The one pattern, ten sites

Every finding here is the same shape: an async action can be re-triggered (or a slow response can land late) while an older invocation is still in flight, and the stale one wins. Two sub-shapes and their fixes:

- **Re-entrancy (double-dispatch)** — a click handler guards on reducer/async-derived state (`isRunning`/`isStreaming`/`isCliRunning`) that lags a render behind, so two dispatches in one tick both pass. Fix: a **synchronous ref latch** flipped the instant the handler begins and released on every terminal path. Sites: CLI submitPrompt/executeTask (`dispatchingRef`), Character wizard (`dispatchLockRef`), Inventory create (`submittingRef`).
- **Stale-response (out-of-order fetch)** — no request sequencing, so a slower older response overwrites a newer one. Fix: a **monotonic request token** captured at dispatch; drop the response unless it's still latest. Sites: global search (`searchSeqRef`), feature matrix (`requestIdRef`), prompt evolution store (per-key seq), UE5 bridge rAF (live-update flag), Preflight (per-project generation), PathBrowser (`browseSeqRef`).

Plus two non-token fixes bundled with their context:
- CLI **heartbeat resume** — heartbeats were started once and cleared on hide but never re-armed on re-show, so a backgrounded-but-healthy run got force-failed by the next stuck-check. The visibility effect now re-arms the interval for the current task.
- App-shell **cross-project index guard** — a module-level `indexEnsuredThisSession` boolean never reset on project switch; replaced with `indexEnsuredForPath` keyed by the active project.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors (full project, after all 5 commits) |
| Touched-area tests | 44/44 pass (cli 17, project-setup, game-systems/Preflight, PromptEvolution, NewHome/PathBrowser consumer) — plus each agent ran its own local suite green |

Character wizard, Inventory catalog, and Global search have no test files (noted; candidates for Wave 6 test-backfill).

## ⚠️ Environment note — concurrent external writer on the pof checkout

During this wave an **external background loop (`.claude/green-loop/` — a ship/green loop in the pof repo) was actively committing to the checked-out branch and leaving uncommitted working-tree changes.** Observed:
- It interleaved two of its own commits into this branch between Wave 2 and Wave 3: `ed8b3d7a research: Qwen-VLM…` (docs/research only) and `9681820e chore(deps): npm update batch` (package.json/lock + LayoutLab.navigation.test.tsx).
- It leaves stray modified/untracked files (`src/lib/status/statusModel.ts`, `next.config.ts`, `docs/catalog/WIRING-AND-ACCEPTANCE.md`, `.claude/green-loop/`, `scripts/headless-coverage.mjs`).

Mitigation applied: every fix was committed immediately, and each commit staged **only its own exact fix files** (never `git add -A`), so no external-writer changes were captured into my commits and none of my work was lost. The external commits touch disjoint files from every fix, so there is no conflict. **Risk that remains:** a `git reset --hard`/`git stash` from the external loop could wipe an agent's *uncommitted* edits mid-wave. Recommendation for Waves 4–6: isolate into a dedicated git worktree off this branch's HEAD (per the repo's concurrent-worktree recovery procedure) so the external loop can't touch in-flight edits.

## Cumulative status (Waves 1–3)

- **9/9 Criticals** + **10 High** findings closed, 18 fix commits + 3 wave-summary docs.
- Pattern catalogue: 7 items (the Wave-3 request-token/ref-latch pattern is catalogue item 1, reconfirmed at 10 more sites).

## What remains

Wave 4 (remaining Highs — unconfirmed destructive-action guards, global-state leaks like the audio catalog + post-process dual-state, remaining success-theater Highs), Wave 5 (design-system consistency sweep — Fable), Wave 6 (Low tail + dead-code + test backfill).
