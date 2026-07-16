# Bug+UI Scan Fix Wave 6 — Data-Integrity Highs + Remaining Races

> 6 commits, 21 High-severity findings closed (1 deferred with cause). Data-corruption cluster + the last of the concurrency races.
> **This wave hit a real data-loss incident (agent `/verify` → `git stash` churn) — see the incident note. All lost work was recovered from dangling stash commits; nothing shipped is missing.**

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `6ea8fd36` fix(economy,gdd,ai-testing,blueprint): guard four double-submit/stale-response races | economy #1, gdd #2, ai-testing #2, blueprint #2 | economySimulatorStore.ts, useGameDesignDoc.ts, AIBehaviorView/index.tsx, BlueprintTranspilerView/index.tsx |
| 2 | `80ff8d35` fix(layout-lab,item-pipeline): unique asset slugs, real tooltip data, per-entity drain, produce-fix guard | item-pipeline #2 #4, layout-lab #1 #2 | itemsSteps.ts, ItemArt.tsx, ItemAnimAudio.tsx, ItemIntegration.tsx, useBaseline.ts, StepFrame.tsx |
| 3 | `2185b209` fix(audio,post-process,gdd): single source of truth for scene catalog, effect stack, resolved gaps | audio #1, level-materials #4, gdd #1 | audioEventCatalogStore.ts, AudioEventCatalog/index.tsx, AudioView/index.tsx, PostProcessStackBuilder/index.tsx, gddComplianceStore.ts, +2 tests |
| 4 | `1ca51326` fix(blender,loot): hydrated host/port, path-keyed dep graph, unique ids, preserved loot source | blender #1 #2, loot #1 #2 | BlenderConnectionBar.tsx, scan-assets/route.ts, AssetInventory/{AssetCard,DependencyGraph}.tsx, sub_loot/{LootTableEditor,_shared/data-binding,_shared/codegen,affix/useLootTableImport} |
| 5 | `95d078d6` fix(character,combat): reset steps on source switch + surface the combo opener rule | character #1, combat #2 (+ character #3 deferred) | CharacterSourceWizard.tsx, TimelineBlock.tsx |
| 6 | `1c329d56` fix(ai-behavior,game-director,crash): confirm destructive delete, fix cover radius, expire snoozes, reset-filter refetch | ai-behavior #1 #3, game-director #1, crash #2 | SandboxTab.tsx, TacticalCoverAnalysis/helpers.ts, game-director-db.ts, PatternLibraryView/index.tsx |

## Findings closed (21)

- **ID/name/path collisions (data corruption):** Item `slug()` collisions → `entitySlug()` with id-token disambiguation; Loot `Date.now()` ids → `crypto.randomUUID()`; Blender dep graph keyed by basename → full path.
- **Single-source-of-truth:** audio event catalog scoped per scene (was global, cross-scene mutation); post-process stack reads one store (was a divergent local clone); GDD resolved-gap markers merged across re-audits (were wiped).
- **Silent mislabels / stale data:** UE5 loot import preserves the real source (was hardcoded "enemy"); ItemIntegration tooltip reads the produced artifact (was hardcoded); Blender Connect uses hydrated host/port (was pre-hydration default); snoozed findings expire; PatternLibrary refetches on filter reset.
- **Races / double-submit:** economy sim run-token, GDD generate token, AI-testing mark-running ordering, blueprint parse/transpile latch, layout-lab per-entity drain + produce-fix latch.
- **Destructive-action safety:** Delete Suite confirmation + in-run guard.
- **Correctness:** pillar cover-occlusion radius (was 2× rendered size); combo opener rule made visible.

**Deferred (1):** character-genome-designer #3 (unwired `useGenomeHistory` undo/redo) — the entire genome-editing slice was deleted on this branch (commits `2443a04f`, `f27cd8f1`); wiring the hook would resurrect intentionally-removed dead code. Not a regression; recorded as won't-fix.

## ⚠️ Incident: agent `/verify` → `git stash` destroyed (then recovered) two agents' work

**What happened:** Wave 6 ran 6 parallel edit-only agents on the shared pof checkout. At least three of them internally invoked a `/verify`-style helper that runs `git stash push` — a *tree-wide* checkpoint. With multiple agents stashing/popping/dropping concurrently, one agent's `git stash drop` discarded the snapshot holding two *other, already-finished* agents' uncommitted edits (the destructive-UX and character/combat fixes). Those files reverted to HEAD before I could commit them; my `git add` found nothing to stage.

**Recovery:** the wiped edits survived as a **dangling stash commit** (`3a595ff2…`). Found via `git fsck --no-reflogs | grep 'dangling commit'`, confirmed it held all 6 files' fixes (`git diff --quiet HEAD <sha> -- <file>`), and restored with `git checkout <sha> -- <files>`. All 21 fixes are committed and verified — nothing is missing.

**Root cause is the agents, not just the external green-loop.** The durable lesson (now in harness memory): never let parallel write-subagents run `/verify`/`/run`/anything that does `git stash`/`git reset`/`git checkout .` on a shared checkout — restrict them to `tsc`/`vitest` for verification, or isolate each in a worktree. This is why every fix in this run was committed immediately with only its exact files staged; that discipline is what kept committed work safe throughout.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors (full project, after all 6 commits + recovery) |
| Full `vitest run` | 4461 passed / 1 failed / 5 skipped — **the 1 failure is NOT ours** (see below) |

**On the 1 failing test:** `src/__tests__/api/pipeline-artifacts-post.test.ts` ("Ship-loop Milestone 1 (pipeline truth-seam)") fails `expected 'fail' to be 'pass'`. This is the **green-loop's own in-progress work**: its dependencies (`lib/catalog/pipelines/*`, `lib/catalog/headless.ts`, `lib/catalog/acceptance/*`) were changed by the ship-loop's own commits interleaved into this branch (`feat(pipeline-acceptance-engine): …`, `feat(pipeline-step-components): …`), and its checker/test convergence isn't complete. **None of the scan's changed files are in that test's import path** (verified by grep), and it passed at the scan baseline — so it is not a regression from these fixes. Left untouched: it's the loop's active code and editing it would collide with concurrent work. Flagged for the user.

Per-agent local suites during the wave (all pass): race-guards 34, layout/item 86, single-source 31, blender/loot 52, character/combat 27, destructive-UX 154.

## Pattern catalogue (items 13–15)

13. **Lossy identity keys corrupt silently** — deriving an asset path / graph key / entity id from a lossy transform (strip-non-alnum slug, basename, `Date.now()`) means two distinct things collide the moment they normalize equal, and the second silently overwrites the first. Key by something injective (full path, uuid, id-token-disambiguated slug).
14. **One concept, one store** — a local `useState` clone of shared state (or a global store with no scoping key) guarantees divergence/cross-contamination. Read/write the single scoped store; scope global stores by the owning entity.
15. **Concurrent git-stashing agents lose each other's work** — parallel write-agents that each run a git-touching verify helper on one checkout will stash/drop over each other. Restrict verification to non-git tools, or give each agent an isolated worktree. Recover losses from dangling stash commits via `git fsck`.

## Cumulative status (Waves 1–6)

- **9/9 Criticals closed.** **Highs: 49/51 closed** (11 W3 + 7 W4 + 10 W5 + 21 W6 = 49), 1 deferred with cause (character #3, deleted-slice dead code), 1 duplicate (app-shell #1/#2 counted once per commit). Effectively **every High from the scan is resolved or deferred-with-cause.**
- 34 fix commits + 6 wave-summary docs, 0 regressions across six verification passes.

## What remains

The Medium/Low tail (234 findings) + test backfill for the 3 uncovered contexts (Character wizard, Inventory catalog, Global search) — a future pass. All Criticals and the targeted High cluster are closed.
