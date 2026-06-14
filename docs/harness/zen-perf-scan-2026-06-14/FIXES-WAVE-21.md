# Zen-Perf Fix Wave 21 — Medium Batch (reflow / dead-code / dedup / memo)

> 5 medium findings closed (a 6th, cli-task callback dedup, was already resolved in a prior wave —
> the remaining dup is in out-of-scope cli-service.ts).
> Baseline preserved: tsc 0→0; tests 15 fail / 3973 pass; 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 05 #2 | CatalogGearTab: derive grid column count from a cached breakpoint (useViewportAtLeast) instead of getComputedStyle per arrow-key press | 8 |
| ctx 28 | delete dead buildTemplateFamilies + the always-0 templateFamilies stat (engine + store + type) | 35 |
| ctx 02 | inline the no-op getEffectiveAttrs + dedup buildBuckets onto the canonical buildHistogram | 79 |
| ctx 10 | share Blender-NLA export + state taxonomy across the two state-machine views; canonical NLA frame duration = 30 (drift fix: AnimationStateMachine's export changes 60→30 to match the project's 30 FPS standard) | 52 |
| ctx 26 #3 | memoize FeatureMatrix grouped/categories (keyed on filtered) + lastReviewed/neverReviewed (on features) | 5 |

**cli-task callback dedup (ctx 27):** no change — a prior wave already collapsed the cli-task.ts side to one extractCallbackPayload + one registry; the genuine remaining duplicate lives in cli-service.ts (outside the single-file scope). The two registries are keyed differently (callback-id vs execution-id) and are not redundant.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3973 pass — baseline (no regressions) |
| ESLint (changed files) | 0 errors (4 pre-existing unused-var warnings) |

## Cumulative (all merged PRs + this branch)
**119 / 176 closed — ~65 high + 54 medium** (+#37). Remaining: ~2 scattered highs + ~22 mediums + 27 lows — deep in diminishing-returns territory.
