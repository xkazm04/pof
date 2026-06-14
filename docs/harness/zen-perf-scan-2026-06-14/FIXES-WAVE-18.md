# Zen-Perf Fix Wave 18 — Medium Batch (dead-code / perf / lifecycle)

> 6 medium findings in distinct untouched files. Concurrent dispatch with git ops forbidden
> (per the Wave-16 lesson) — no collision this time.
> Baseline preserved: tsc 0→0; tests 15 fail / 3973 pass (−3 = deleted PipelineRollup tests); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 17 | delete dead PipelineRollup.tsx (149 LOC, test-only) + its tests | 2 |
| ctx 10 | remove the fake 600ms "AI processing" delay from the combo generator (synchronous + instant) | 10 |
| ctx 11 | level-design getSummary: SELECT rooms,sync_status only (was SELECT* + 4 JSON.parse/row), single-pass | 29 |
| ctx 14 | memoize AudioScenePainter scene-bounds so panning doesn't rebuild the minimap | 26 |
| ctx 22 | index strings by id for the Translation list (O(n²) → O(n)) | 10 |
| ctx 32 | bound retained build stdout to a 256KB tail (was unbounded in memory + DB) | 17 |

All behavior-preserving (or, for the fake-delay removal, a strict UX improvement). The
AIComboChoreographer fix also dropped the now-unused isGenerating setter (cleanup commit).

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3973 pass — baseline (no regressions; −3 passing = deleted PipelineRollup tests) |
| ESLint (changed files) | 0 errors |

## Cumulative (all merged PRs + this branch)
**102 / 176 closed — ~65 high + 37 medium** (+#37). Remaining: ~2 scattered highs + ~39 mediums + 27 lows (all lower-value). We are well into diminishing returns.
