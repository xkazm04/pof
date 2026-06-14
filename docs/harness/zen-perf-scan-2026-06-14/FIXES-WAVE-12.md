# Zen-Perf Fix Wave 12 — Lifecycle / Resource Mediums

> 6 findings closed. Timers, sockets, backoff, and animation lifecycles — add cleanup/
> caps/guards without changing behavior. Final fix wave of this run.
> Baseline preserved: tsc 0→0; tests 15 fail / 3970 pass (identical); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 15 (bridgeExecutor) | arm the poll timeout once + cap total poll wall-clock (was a fresh 120s AbortController per iteration) | 62 |
| ctx 32 (connection-manager) | reset reconnectAttempts on a fresh healthy→failed transition so backoff starts clean | (none) |
| ctx 33 (harness verifier) | clear + unref the fallback kill-timer on command completion (was leaking a 121s timer per gate) | 12 |
| ctx 13 #3 (blender service) | 8MB receive-buffer cap (fast-fail) + per-command-class timeouts; Wave-3 brace gate untouched | 4 |
| ctx 07 (perception cone) | pause the perpetual repeat:Infinity animations when off-screen (IntersectionObserver) | 4 |
| ctx 07 (BTFlowchart) | drive keyboard nav by node id, not DOM child index (robust to ordering divergence) | 7 |

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3970 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (introduced 1 prefer-const, fixed in a follow-up; remaining warnings pre-existing) |

## Cumulative status — all 12 waves

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
| 12 | Lifecycle / resource mediums | 6 |

**Total closed: 73 / 176** (74 counting #37) — **42 high + 31 medium**.

Accurate accounting (correcting earlier loose "all highs" phrasing): of the 67 high
findings, **42 are closed** — the full dead-code (7/7), leaks (6/6), algorithmic (9/10),
DB-N+1 server-side (6/10), and re-render (12/13) work, plus the flagship correctness
items (#14 damage formula, #45 blueprint, #66 GDD singleton, #35 dup alerts). **~25 highs
remain**, mostly:
- **Duplication theme (~10):** post-process effect systems, BT data models, two connection
  managers (pof-bridge vs ue5-bridge), ability-forge prompt bypass, audio CLI plumbing,
  item-pipeline step scaffold, localization 5× re-scan, useProjectScan double-list.
- **Wave 2b (never run, 4):** searchPolyHaven full-catalog fetch, AIBehaviorView per-keystroke
  PUT + double refetch, FindingsExplorer per-session fan-out.
- **Misc highs:** deep-eval 69-pass serial execution (#60), budget governor overshoot (#61),
  GlobalSearch FTS rebuild-on-open (#64), coverage-heatmap O(72·N) scan (#63), combat-summary
  12-pass (#62), health-completion denominator mismatch (#65), combat tick allocation (#36),
  inventory dual-source-of-truth (#53), buildTaskPrompt 540-line switch (#67).

Plus ~46 mediums + 27 lows. This is the final fix wave of this run — a PR follows; the
remaining highs are a good scope for a follow-up branch.
