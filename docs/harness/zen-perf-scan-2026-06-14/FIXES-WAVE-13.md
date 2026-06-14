# Zen-Perf Fix Wave 13 — High-Value Standalone Highs

> First wave after PR #2 merged (fresh branch off master). 6 high-severity findings closed —
> the self-contained, high-impact highs that weren't part of a cross-file consolidation.
> Baseline preserved: tsc 0→0; tests 15 fail / 3976 pass (+6 new, no regressions); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| #60 (ctx 21) | deep-eval passes run with bounded concurrency (pool of 4) instead of strictly serial; results byte-identical via per-index slots; passStatuses race-free | 31 |
| #64 (ctx 25) | GlobalSearch FTS index built once per session (lazy guard) instead of full rebuild on every open | 3 |
| #63 (ctx 24) | memoize coverage best-positions sort + LOS-trace filter so hover doesn't recompute them | 9 |
| #65 (ctx 19) | unify overall-completion denominator with the weekly digest (all-module total, not core-only) — dashboards now agree | 34 |
| #62 (ctx 02) | single-pass computeSummary (~17 traversals + 3 sorts → 1 loop + 2 sorts); summary byte-identical | 74 |
| #61 (ctx 33) | reserve budget at session launch + reconcile on return so the governor stops overshooting the cap by (maxConcurrent−1) | 70 |

Each preserves output/behavior (or, for #65, fixes a genuine correctness divergence); behavior-sensitive ones (concurrency #60, governor #61, denominator #65) carry new/updated tests.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3976 pass — no regressions (+6 new harness reservation tests) |
| ESLint (changed files) | 0 errors (16 pre-existing hardcoded-hex chart-color warnings in TacticalCoverAnalysis) |

## Cumulative (across merged PR #2 + this branch)

**79 / 176 findings closed** — **48 high + 31 medium** (+#37 by deletion). After this wave, **~19 highs remain** (the duplication theme ~10, the never-run Wave 2b client over-fetch ~4, combat tick #36, inventory dual-source #53, buildTaskPrompt #67, and a couple more) plus ~46 mediums + 27 lows.
