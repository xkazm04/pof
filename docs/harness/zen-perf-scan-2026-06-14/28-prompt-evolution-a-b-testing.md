# Prompt Evolution & A/B Testing — zen-perf scan
> Context: Prompt Engineering / Prompt Evolution & A/B Testing
> Total: 5
> Severity: critical=0 high=1 medium=3 low=1

## 1. Agglomerative clustering is O(n³) — full pairwise rescan every merge
- **Severity**: high
- **Lens**: performance
- **Category**: algorithmic-complexity
- **File**: src/lib/prompt-evolution/clustering.ts:93
- **Scenario**: Bites whenever a module has accumulated many sessions and the user opens the Clusters tab or the Optimizer (Pass 3) runs. `clusterPrompts` is called from `cluster-prompts`, `get-suggestions`, and inside `optimizePrompt` — all synchronous, all on the request thread.
- **Root cause**: The `while (clusters.length > maxClusters)` loop runs up to `n - 8` times. Each iteration does a full O(n²) double loop (lines 98-107) recomputing `jaccardSimilarity` over the *entire* current cluster set, even though only two clusters changed since the last pass. `jaccardSimilarity` itself iterates the (growing, post-merge unioned) token set each call. Net cost ≈ O(n³ · avg_tokens). Merged clusters also union token sets unbounded (line 117), so each `jaccardSimilarity` gets slower as merges proceed.
- **Impact**: For ~200 sessions this is tens of millions of set lookups on a blocking API route; the cost grows cubically, so a busy module degrades sharply. Most of the work is redundant — pairwise similarities between untouched clusters never change between iterations.
- **Effort**: 5 · **Value**: 7
- **Fix sketch**: Compute the pairwise similarity matrix once into a max-structure (or a flat array of `{i,j,sim}` sorted desc), then on each merge only invalidate/recompute the row+column for the merged cluster instead of rescanning all pairs. Alternatively cap input size (e.g. take the most recent N sessions) before clustering, since `getBestCluster` already only trusts clusters with ≥3 sessions. Even a simple "recompute only against the merged node" change drops it to ~O(n²).

## 2. `buildTemplateFamilies` is dead code; `templateFamilies` stat is permanently 0
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead-code / misleading-metric
- **File**: src/lib/prompt-evolution/engine.ts:274
- **Scenario**: The Stats panel renders `stats.templateFamilies` (via `EvolutionStats.templateFamilies`), but it always shows 0.
- **Root cause**: `buildTemplateFamilies` is exported but never called — not by the API route (`route.ts` has no `build-template-families` action) nor anywhere in `src` (grep confirms only the definition and the internal `templateFamilies.set`). The module-level `const templateFamilies = new Map()` (engine.ts:42) is therefore never populated, so `getEvolutionStats` reads `templateFamilies.size` === 0 forever (engine.ts:463). The function also hardcodes `avgSuccessRate: 0` / `avgDurationMs: 0` (engine.ts:308-309) with a "Would need session data" comment, so even if called it produces half-empty families. The whole `TemplateFamily` type, the Map, and the genId('fam') path are effectively unreachable.
- **Impact**: ~45 lines of unreachable logic plus a global mutable Map that exists only to feed an always-zero stat — confusing for maintainers and a dishonest dashboard number. If ever wired up as-is, the module-level Map would also accumulate stale families across calls (new random ids every invocation, never cleared), double-counting.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Either delete `buildTemplateFamilies`, the `templateFamilies` Map, and the `templateFamilies` field from `EvolutionStats` (and the UI/store/test references), or finish wiring it: add an API action, compute real avg rates from sessions, and rebuild the Map per-call instead of accumulating. Given it has never shipped a non-zero value, removal is the higher-value option.

## 3. Unused epsilon-greedy serving + in-memory trial recording in ab-testing.ts
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead-code
- **File**: src/lib/prompt-evolution/ab-testing.ts:36
- **Scenario**: Reading the A/B module suggests variants are auto-served via `pickVariant` (epsilon-greedy) and tallied via `recordTrial`, but neither is reachable in production flow.
- **Root cause**: `pickVariant` (line 36) and `formatTestSummary` (line 130) have zero callers in `src` (grep confirms only definitions). `recordTrial` (line 63), the JS read-modify-write tally, is also unused — the engine deliberately routes trial recording through `recordTrialAndEvaluate` in evolution-db.ts (atomic SQL increment) and notes the old RMW path "lost concurrent trials" (engine.ts:239-242). So the live system only ever calls `evaluateTest`. The presence of the superseded `recordTrial` next to its replacement is a trap — a future caller could pick the wrong one and reintroduce the lost-update bug.
- **Impact**: Three exported functions (~50 lines) imply a variant-serving strategy that doesn't exist; the dead `recordTrial` actively invites the concurrency bug the DB path was written to fix.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Delete `pickVariant`, `recordTrial`, and `formatTestSummary` unless one is slated for imminent use. If epsilon-greedy serving is genuinely planned, leave a one-line comment pointing at the intended call site; otherwise remove to keep `evaluateTest` as the single source of A/B logic.

## 4. `generateSuggestions` and `getEvolutionStats` re-query and re-scan all rows
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated-queries / redundant-iteration
- **File**: src/lib/prompt-evolution/engine.ts:392
- **Scenario**: Every `get-suggestions` request (fired on each module selection in the UI, engine.ts:158) and every `get-stats`/`init`.
- **Root cause**: In `generateSuggestions`, `getActiveTests(moduleId)` (line 352) calls `getAllABTests()` — a full-table SELECT — and then line 392 calls `getAllABTests()` *again* for the concluded filter. Two identical full scans per call. Separately, `getEvolutionStats` (engine.ts:426-455) loops over every module and inside the loop re-runs `allVariants.filter`, `active.filter`, and `concluded.filter` (lines 427-429), i.e. O(modules × (variants+tests)) re-iteration of arrays it already holds.
- **Impact**: Small today, but it is wasted work on a hot path that scales with both module count and test/variant volume. The double `getAllABTests()` is pure duplication.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: In `generateSuggestions`, fetch `const allTests = getAllABTests()` once and derive active/concluded subsets from it (drop the `getActiveTests` round-trip). In `getEvolutionStats`, bucket variants/tests by `moduleId` in a single pass into `Map<moduleId, …>` instead of filtering the full arrays once per module.

## 5. `init()` followed by per-module `loadVariants`/`loadSuggestions` triggers serial round-trips with no abort
- **Severity**: low
- **Lens**: both
- **Category**: data-fetching / re-render
- **File**: src/stores/promptEvolutionStore.ts:110
- **Scenario**: On mount the view calls `init()` (POST get-stats, then awaits `loadTests` = a 2nd POST), then the `selectedModuleId` effect (PromptEvolutionView.tsx:154-159) fires `loadVariants` + `loadSuggestions` as two more independent POSTs. Rapid module switching stacks responses.
- **Root cause**: Each store action is its own `apiFetch` POST to the same `/api/prompt-evolution` endpoint with no request coalescing or cancellation. `loadVariants` and `loadSuggestions` run sequentially via separate awaits in the effect, and there is no guard against an older module's response landing after a newer selection (last-write-wins on `set({ variants })`).
- **Impact**: 4 sequential POSTs to one route on first paint; on fast module toggling a stale module's variants/suggestions can overwrite the current selection's data. Minor at current scale but a latent correctness wrinkle.
- **Effort**: 4 · **Value**: 3
- **Fix sketch**: Fire `loadVariants` and `loadSuggestions` in parallel (`Promise.all`) and tag responses with the requested `moduleId`, discarding a response in `set()` if `get().selectedModuleId` no longer matches. Optionally batch the initial stats+tests into one action since both are unconditional on mount.
