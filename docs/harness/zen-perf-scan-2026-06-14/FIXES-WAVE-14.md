# Zen-Perf Fix Wave 14 — Duplication Theme (behavior-preserving consolidations)

> 5 high findings closed; 1 correctly stopped (needs a product decision). The
> behavior-preserving half of the duplication theme — drifted/architectural copies deferred.
> Baseline preserved: tsc 0→0; tests 15 fail / 3976 pass (identical); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| #23 (ctx 30) | useProjectScan lists Source once, not twice (4→3 list calls) | 7 |
| #20 (ctx 22) | localization full-pipeline computes the translatable filter once (shared isTranslatable predicate; 3×→1×) | 37 |
| #19 (ctx 16) | extract StaticStepFrame, collapse 10 copy-pasted Items-pipeline step prologues (memoized acceptance) across 6 files | 15 |
| #22 (ctx 29) | dedup the 4 byte-identical extraRules blocks into prompts/_shared.ts (11 builders); drifted variants left inline — **zero emitted-prompt change** | 93 |
| #16 (ctx 08) | quest-gen builds adjacency + id indices once (O(n³) clear-quest pass → O(n+e)); output byte-identical | 8 |

## Stopped (correctly) — needs a product decision

**#15 — Two parallel behavior-tree data models** (`BT_NODES`/`BT_EDGES` vs `BT_TREE`). The subagent found these are **not redundant encodings** — `BT_NODES` is an old 8-node sample tree (the metric tile shows "8 nodes / 4 depth"); the canonical `BT_TREE` is the real 54-node tree. Deriving the metric from `BT_TREE` would flip the tile to "54 / 6" — a visible ~7× change, not a behavior-identical refactor. **Decision needed:** should the BehaviorTreeMetric reflect the real tree (accept 8→54, 4→6) or keep showing the sample (then the flat graph isn't dead)?

## Deferred (behavior-changing / architectural — need a decision or a focused wave)

- **#17 post-process effect systems** — two effect lists that already disagree (7 vs 10); unifying picks a canonical set (effects appear/disappear). Design decision.
- **#21 ability-forge prompt** — bypasses the shared context system; wiring it through ADDS guardrails to the emitted prompt (a deliberate output change).
- **#18 audio CLI plumbing** — duplicated verbatim across many module views; extracting a shared component is a large mechanical refactor touching every module view.
- **#24 two connection managers** (pof-bridge client vs ue5-bridge server) — opposite execution models; a real architectural consolidation.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3976 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (33 pre-existing unused-import/param + hex warnings) |

## Cumulative (merged PR #2 + this branch, waves 13–14)
**84 / 176 closed — 53 high + 31 medium** (+#37). ~14 highs remain (the deferred dup highs above + #15 + Wave 2b client over-fetch + a few), plus ~46 mediums + 27 lows.
