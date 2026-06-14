# Zen-Perf Fix Wave 22 — Medium Batch (dedup-fetch / O(n²) / regex / fan-out)

> 6 medium findings in distinct untouched files. The final fix wave of this run.
> Baseline preserved: tsc 0→0; tests 15 fail / 3975 pass; 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 26 #4 | share the all-statuses fetch via a new useFeatureStatuses() cache (NBA + FeatureMatrix: 2 fetches → 1) | 62 |
| ctx 17 | CatalogTree: memoize visibleCatalogs + Map index (render `indexOf` O(n²) → O(1)) | 5 |
| ctx 23 | CookProgress: incremental log-facet counts (refs) instead of rescanning the ≤2000-line array per tick | 25 |
| ctx 31 | blueprint-jargon: one precomputed regex sweep instead of ~60 includes/line (with a substring/straddle-aware fallback; differential-tested over 500 cases) | 30 |
| ctx 30 | recent-projects: save/touch return the freshened list → drop the duplicate GETs (4 → 2 round-trips/switch) | 18 |
| ctx 06 | AffixRollSimulator: Map-index affix lookups + memoized frequency rows (no linear scan on the spin path) | 3 |

## Process note
The useFeatureStatuses migration first left the NBA recommendations computed in a synchronous useEffect+setState (react-hooks/set-state-in-effect error). Caught in lint; converted to a useMemo (derived state) with refresh invalidating the shared cache. Fixed before the wave closed.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3975 pass — baseline (no regressions) |
| ESLint (changed files) | 0 errors (2 pre-existing unused-var warnings) |

## Cumulative (all merged PRs + this branch)
**125 / 176 closed — ~65 high + 60 medium** (+#37). Remaining: ~2 scattered highs + ~16 mediums + 27 lows.
