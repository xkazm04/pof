# Zen-Perf Fix Wave 8 — Medium Memoization / Timer Sweep (batch 1)

> First batch of the medium-severity pass (82 mediums total). 6 commits, 6 findings closed.
> All behavior-preserving memoization / timer-consolidation in distinct untouched files.
> Baseline preserved: tsc 0→0; tests 15 fail / 3959 pass (identical); 0 lint errors.

## Commits

| Commit | Finding | Fix |
|---|---|---|
| (progression) | ctx 09 | React.memo the prop-less Curves siblings (MultiCurveOverlay, MilestoneTimeline) so slider drags don't re-render them |
| (gdd) | ctx 20 | React.memo MarkdownBlock + memoize its parse → re-parses only on content change (23 tests) |
| (materials) | ctx 11 | useMemo the MaterialBudgetBar cost report (keyed on surfaceType/features) (7 tests) |
| (blender) | ctx 13 #4 | Precompute AssetInventory edge counts once (O(C·D) → O(D) + O(1)/card) |
| (audio) | ctx 14 | useMemo AudioView `ctx` so the generation useCallbacks stay stable (53 tests) |
| (visual-gen) | ctx 12 | One shared 1s ticker for the generation queue instead of one setInterval per card (15 tests) |

All fixes preserve identical output/behavior — verified by complete memo deps + passing component tests.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3959 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (4 pre-existing dead-sort-UI warnings in AssetInventory.tsx) |

## Cumulative status — all waves

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted) |
| 5 | React re-renders (batch 2) | 6 |
| 6 | Resource leaks / lifecycle | 6 |
| 7 | Correctness consolidation | 4 |
| 8 | Medium memoization sweep (batch 1) | 6 |

**Total closed: 49 / 176** (50 counting #37). All highs done; ~76 mediums + 27 lows remain.

## Remaining medium clusters (for future batches)
- **Re-render/memo** (~25 left): StateMachineEditor showCode gate, economy buildSupplyDemand avgGold×5, CatalogGearTab arrow-key reflow, etc.
- **DB/fetch** (~7): ability-spec-db per-call DDL, BuildConfigSelector N HTTP/mount, BuildHistoryDashboard 4 requests, game-director getDirectorStats 7 queries.
- **Correctness** (~8): combat-trace prose-before-JSON parser drop, entries[0]! crash, gdd-synthesizer pairwise-mean bug, AttackRing viewBox clip, weekly-digest streak truncation.
- **Duplication** (~7): Leonardo 3 identical poll loops, ability damage-formula vs simulator, DR/danger-zone chart geometry ×2.
- **Lifecycle** (~5): bridge poll AbortController/iteration, connection-manager reconnectAttempts reset, harness verifier kill-timers.
- Plus **deferred** items from the high waves (#3 inventory cardRefs refactor, #12 CLITabBar/CLIBottomPanel, session_analytics index).
