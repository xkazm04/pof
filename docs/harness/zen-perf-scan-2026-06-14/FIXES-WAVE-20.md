# Zen-Perf Fix Wave 20 — Medium Batch (sim/query/re-render/code-split)

> 6 medium findings in disjoint files. Concurrent, git ops forbidden — no collision.
> Baseline preserved: tsc 0→0; tests 15 fail / 3973 pass; 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 04 | economy buildSupplyDemand: compute per-level avgGold once (was 5× per level), single-pass sum | 14 |
| ctx 34 | session-analytics recordSession: drop the redundant post-INSERT SELECT (caller discards the return) | — |
| ctx 10 | StateMachineEditor: skip C++ codegen when the code panel is hidden (showCode-gated memo) | 35 |
| ctx 01 | HistogramChart: stable bucket keys + memo'd Bar + CSS hover (no per-hover re-render) | 37 |
| ctx 02 | combat-simulator route: free the full fights array before serializing the trimmed response | 124 |
| ctx 25 | ModuleRenderer: lazy-load 28 module components (code-split out of the shell chunk, existing Suspense covers) | 14 |

All behavior-preserving (the combat-sim note: the full fix needs an engine-side onFight callback, out of scope; this frees the array for GC pre-serialize).

## Process note
The HistogramChart subagent's first pass gated the entrance animation via a ref read during render (react-hooks/refs error — same trap as wave 15's debounce). Caught it in lint and removed the gate (it was unnecessary: framer-motion's `initial` applies only on mount, and the memo already stops hover re-renders). Fixed before the wave closed; final lint 0 errors.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3973 pass — baseline (no regressions) |
| ESLint (changed files) | 0 errors |

## Cumulative (all merged PRs + this branch)
**114 / 176 closed — ~65 high + 49 medium** (+#37). Remaining: ~2 scattered highs + ~27 mediums + 27 lows.
