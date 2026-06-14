# Zen-Perf Fix Wave 11 — Medium Algorithmic + Dedup Sweep

> 6 findings closed (distinct untouched files). Mix of memoization, dedup, and
> O(n·m)→O(n+m) algorithmic fixes — all output-identical.
> Baseline preserved: tsc 0→0; tests 15 fail / 3970 pass (identical); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 09 (DR visualizer) | memoize shared chart geometry (3× inline → 1, skipped unless inputs change) | 45 |
| ctx 06 (loot) | extract shared enemyMap + rarityColorFor to _shared/data.ts (dedup index/filters) | 22 |
| ctx 29 (menu-flow) | index screens by id (O(transitions·screens) → O(n+m)); prompt byte-identical | (none) |
| ctx 19 (insights) | hoist linkEntityToModule match corpus out of the per-entity loop (no re-lowercasing); fuzzy match preserved | 34 |
| ctx 34 (genre-evolution) | single-pass extractSignals (~17 array sweeps → 2) + remove dead headerPaths | 12 |
| ctx 12 (visual-gen) | extract one shared pollUntilReady for the 3 generation poll loops (new visual-gen/poll.ts) | 41 (1 pre-existing fail unchanged) |

All preserve identical output/behavior (verified by reasoning + passing tests).

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3970 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (4 pre-existing unused-var warnings on master) |

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
| 8 | Medium memoization sweep | 6 |
| 9 | Medium DB/fetch consolidation | 6 |
| 10 | Correctness mediums (bug-shaped) | 6 |
| 11 | Medium algorithmic + dedup sweep | 6 |

**Total closed: 67 / 176** (68 counting #37). All highs + 24 mediums done. ~52 mediums + 27 lows remain (declining value: mostly v4-v5 re-render/memo, a few lifecycle/duplication).
