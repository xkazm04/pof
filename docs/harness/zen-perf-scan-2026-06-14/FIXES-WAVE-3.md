# Zen-Perf Fix Wave 3 — Algorithmic Hot Loops

> 6 perf commits (+1 lint cleanup), 7 findings closed. Single mental model: replace
> superlinear / repeated-work loops with cached or precomputed equivalents — every fix
> verified output-identical, not just faster.
> Baseline preserved: tsc 0→0; tests 15 fail / 3946 pass (identical to baseline); 0 lint errors.

A finding was also **closed by prior deletion**: #37 (the O(n²) `optimize()` simplex) lived in
`sub_character/attributes/data.ts`, which Wave 1 deleted as part of the orphaned genome slice —
so it required no work here. **Deferred:** #45 (blueprint exec-edge traversal — a correctness bug
needing parser changes, routed to the correctness wave) and #36 (lowest-value tick-loop allocation).

## Commits

| # | Commit | Finding(s) | File(s) |
|---|---|---|---|
| 1 | `f0b4ec7` | #38, #39 (ctx 04) | economy/simulation-engine.ts |
| 2 | `184e801` | #40 (ctx 06) | loot-designer/drop-simulator.ts |
| 3 | `57ba555` | #41 (ctx 13) | blender-mcp/service.ts |
| 4 | `3becf98` | #42 (ctx 17) | layout-lab/labAcceptance.ts |
| 5 | `db986e8` | #43 (ctx 26) | nba-engine.ts, feature-definitions.ts |
| 6 | `7cd6989` | #44 (ctx 28) | prompt-evolution/clustering.ts |
| 7 | `(cleanup)` | — | nba-engine.ts (drop unused import) |

## What was fixed (each verified output-identical)

1. **Economy sim hot loops (#38, #39).** `computeMetrics` (full sort + double reduce/hour) now runs only on the hours `buildMetricsArray` retains (same `step` formula; computeMetrics is pure → bit-identical). `trackSupplyDemand` precomputes per-item run-invariants (`supplyDelta`, `demandFactor`) once instead of recomputing dropMul math + the category test ~2.1M times; mutates the accum bucket in place. **Verified bit-identical across 8 configs** (incl. agentCount=500/maxHours=200), preserving rng draw order + float-add order.
2. **Monte-Carlo drop sim (#40).** Folded 6 passes over the rolled items into 1 — aggregates accumulate inline in the roll loop instead of re-sweeping the (up to 100k) items array 5× afterward. `items` kept (a test reads it) but no longer re-swept. Byte-identical aggregates; test 1/1.
3. **Blender TCP reader (#41).** Replaced "JSON.parse the whole growing buffer on every chunk" (O(k·n)≈O(n²)) with an incremental, string/escape-aware brace-depth scanner that only parses at depth 0 → ~O(n). Can't accept an incomplete message early or skip a complete one. service.test.ts 4/4.
4. **Layout-lab acceptance (#42).** `resolveAccept` did `steps.find(label)` per step → O(steps²) per rollup. Added a per-pipeline `label→Checker` Map cached in a WeakMap → O(steps). First-match semantics preserved; 31/31 tests.
5. **NBA dependent-count (#43).** Replaced a per-item rescan of the ~190-feature dep map (≈modules×items×190 `.some()` passes every render) with a `dependentCounts` Map accumulated once in `buildDependencyMap`'s existing deps pass, cached + exposed via `getDependentCounts()`; O(1) lookup in computeNBA. Edge-count == feature-count (no duplicate `dependsOn` keys). 52/52 tests.
6. **Agglomerative clustering (#44).** O(n³) → O(n²): cache the pairwise Jaccard matrix once; per merge, copy untouched survivor-pair similarities and recompute only the merged node's column. **Identical partitions across 180 randomized runs**; tie-break + merge order preserved exactly.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3946 pass — identical to baseline (no new failures) |
| ESLint (changed files) | 0 errors, 0 warnings (1 new warning introduced + fixed in the cleanup commit) |
| Per-fix equivalence | economy 8-config bit-identical · clustering 180-run identical · loot/blender/layout-lab/nba existing tests pass |

## Patterns established (catalogue, items 9–12)

9. **Compute-then-discard sampling** — an expensive per-iteration metric is computed every iteration, but a downstream sampler keeps only every Nth. Replicate the sampler's stride at the source and compute only on retained iterations. Safe **only if the computation is pure** (no RNG/mutation) — else skipping changes downstream state.
10. **Loop-invariant recompute in a hot inner loop** — per-item arithmetic that depends only on run-constants gets recomputed per-agent-per-hour. Precompute a descriptor array once; the hot loop reads it. For sim/balance math, preserve float-add order *and* RNG draw order/count or results drift.
11. **Full rescan in an incremental algorithm** — agglomerative clustering recomputing the whole O(n²) distance matrix per merge, or a static graph property (dependency fan-out) rescanned per render. Cache the relation and update only the affected row/column on change; precompute-and-memoize purely-static properties. Preserve tie-break/merge order for identical output.
12. **Reparse-on-every-chunk** — accumulating a stream buffer and re-parsing the entire thing on each chunk (O(n²)). Gate the parse on a cheap completeness check (incremental brace-depth or trailing-delimiter) so it parses once when the message is actually complete.

## Cumulative status (waves 1–3)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 closed by Wave-1 deletion) |

**Total closed: 21 / 176** (22 counting #37). Remaining: ~154.

## What remains
- **Deferred from this wave:** #45 (blueprint exec-edge — wrong + O(n²), correctness wave), #36 (combat tick allocation).
- Per the INDEX: Wave 2b (client over-fetch, 4), Waves 4-5 (React re-render, 42 — the largest theme), Wave 6 (resource leaks/lifecycle, 13), Wave 7 (correctness + diverged-logic consolidation, incl. the triplicated damage formula #14 and #45).
