# Zen-Perf Fix Wave 19 — Medium Batch (dedup / re-render / algorithmic / harness)

> 6 medium findings in distinct untouched files. Concurrent dispatch, git ops forbidden — no collision.
> Baseline preserved: tsc 0→0; tests 15 fail / 3973 pass (16 once = the known catalog flake, re-confirmed 15); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 01 | share scale+armor-mitigation core across ability damage-formula + the GAS sim (each keeps its own crit) | 12 |
| ctx 17 | useViewportAtLeast(breakpoint) — re-render on threshold crossings, not every resize pixel (3 consumers migrated) | 28 |
| ctx 21 | AggregateQualityDashboard: spinner only on first load + once-only entrance stagger (no remount/replay on refresh) | ✓ |
| ctx 22 | validateTranslations single-pass roll-up (O(L·E·F) → O(E+F)) | 19 |
| ctx 24 | push squad hover state into FormationView + memoize glyph/row (no full-diagram re-render on hover) | 22 |
| ctx 33 | wireAreaDependencies wires only real edges (first-area→prereq-last-area), not an all-pairs graph — restores plan concurrency | 75 |

All behavior-preserving (identical output / same valid plan); the squad/dashboard/viewport fixes are pure re-render reductions.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3973 pass — baseline (the one 16 was the catalog/ueStaticCheckers flake; re-run confirmed 15) |
| ESLint (changed files) | 0 errors (3 pre-existing unused-import warnings on master) |

## Cumulative (all merged PRs + this branch)
**108 / 176 closed — ~65 high + 43 medium** (+#37). Remaining: ~2 scattered highs + ~33 mediums + 27 lows.
