# Loot & Affix System — zen-perf scan
> Context: Items, Loot & Economy / Loot & Affix System
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Monte-Carlo simulator retains every rolled item in memory for no consumer
- **Severity**: high
- **Lens**: performance
- **Category**: memory / wasted allocation
- **File**: src/lib/loot-designer/drop-simulator.ts:210-213, 309
- **Scenario**: `runDropSimulation` runs synchronously inside a `useMemo` on the React render thread (src/components/modules/core-engine/sub_loot/ai-designer/index.tsx:36-45) every time `rollCount`, `seed`, `rarity`, `itemLevel`, or any affix weight changes. The default `rollCount` is 2000 and the editor exposes it as a tunable input (tests exercise 100_000).
- **Root cause**: the function accumulates a full `items: RolledItem[]` array (one object plus a `SimRolledAffix[]` per roll) and returns it in `DropSimResult`, but no consumer reads `simResult.items` — every panel (Distributions, CoOccurrence, Code) uses only the aggregate `affixDistributions`/`coOccurrence`/histograms. Grep across the ai-designer confirms zero reads of `.items`.
- **Impact**: at 100k rolls this is ~100k–600k retained objects held alive for the lifetime of the memo result, plus the GC churn of building them. The aggregation passes (lines 217, 258, 276, 285, 295, 305) each re-iterate this same large array, so it is 5+ full sweeps over a list that only ever needed to feed running accumulators.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: fold the per-roll aggregation into the roll loop (accumulate `affixCounts`, `coMap`, `axisCoverage`, power histogram min/max via Welford-style two-pass or a fixed-bin streaming histogram) instead of materializing `items`. Drop `items` from `DropSimResult` (or gate it behind a debug flag). This removes the array allocation and collapses 6 passes into 1.

## 2. Loot-table editor live-preview bar renders all entries, ignoring pagination
- **Severity**: high
- **Lens**: both
- **Category**: re-render / unbounded DOM
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:187-193
- **Scenario**: the editor paginates the entry list at 20/page (LootTableEntryList) precisely because the catalog can grow large, yet the live distribution bar below it maps over the full `editorEntries` array, emitting one `<div>` per entry regardless of page or search filter.
- **Root cause**: the preview uses `editorEntries` (unfiltered, unpaged) while the list uses `pagedEntries`. Each weight-slider drag triggers `setEditorEntries` → full re-render, and every entry's width is recomputed inline (`(entry.weight / editorTotalWeight) * 100`) with no memoization. The preview is also inconsistent with the visible list (it shows items the user filtered out).
- **Impact**: dragging a slider re-renders N preview divs synchronously on every `onChange` tick; combined with the history snapshot (a full array clone per tick, capped at 50 in editorHistory) this makes large tables feel laggy during the exact interaction (weight tuning) the tool exists for.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: memoize a `previewSegments` array (`useMemo` over `editorEntries`+`editorTotalWeight`) and consider rendering the preview from `filteredEntries` for consistency with the list. Throttle/`requestAnimationFrame` the slider commit, or commit weight on `onPointerUp` while keeping a local uncontrolled value during drag.

## 3. Duplicated enemyMap / rarity-color lookups across index and LootFilters
- **Severity**: medium
- **Lens**: architecture
- **Category**: duplicated logic / module-scope cost
- **File**: src/components/modules/core-engine/sub_loot/LootFilters.tsx:10 (and index.tsx:16-17)
- **Scenario**: `index.tsx` builds and exports `enemyMap = new Map(ARCHETYPES.map(...))` and `itemMap` at module scope; `LootFilters.tsx` independently rebuilds its own private `const enemyMap = new Map(ARCHETYPES.map(...))` from the same source.
- **Root cause**: two copies of the same derived lookup over the same static `ARCHETYPES` array, plus the active-rarity-color resolution (`RARITY_TIERS.find(t => t.name === ...)`) is open-coded in three places: index.tsx:52, LootFilters.tsx:39, and implicitly via repeated `enemyMap.get(enemyFilter)?.color` (called 6× per render in LootFilters lines 57-82).
- **Impact**: low runtime cost but a real SRP/duplication smell — the exported `enemyMap`/`itemMap` from index.tsx are the natural home, and the repeated `.find`/`.get` chains obscure intent and drift risk if rarity/enemy data changes.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: hoist a single `enemyMap` (reuse the one already exported from index.tsx or move both maps to `_shared/data`). In LootFilters, resolve `const activeEnemy = enemyMap.get(enemyFilter)` once at the top of render and reference `activeEnemy?.color` instead of 6 repeated `.get` calls. Extract a `rarityColorFor(name)` helper for the duplicated `RARITY_TIERS.find` pattern.

## 4. AffixRollSimulator recomputes affix lookups by linear scan on every render
- **Severity**: medium
- **Lens**: performance
- **Category**: missing memoization / O(n) in render
- **File**: src/components/modules/core-engine/sub_loot/affix/AffixRollSimulator.tsx:197, 247-249
- **Scenario**: while a reel is spinning, `setReelText` fires every 80ms (REEL_CYCLE_MS) and the cycle/timeout callbacks each trigger a re-render. The slot render maps `reelText` and calls `colorForAffixName(text)` → `AFFIX_DEFS.find(a => a.name === name)` per slot. The frequency table (lines 247-249) re-sorts `Object.entries(affixHistory)` and does another `AFFIX_DEFS.find` per row on every render.
- **Root cause**: name→color and name→def resolution use linear `Array.find` over `AFFIX_DEFS` instead of a precomputed `Map`, and the frequency table's sort is recomputed inline rather than memoized.
- **Impact**: at ~12.5 renders/sec during a spin, each render does (3 slots + history rows) linear scans plus a full sort of the history map. Small N today, but it is gratuitous work on the hottest render path in this component and scales with affix-pool size.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: build a module-level `const AFFIX_BY_NAME = new Map(AFFIX_DEFS.map(a => [a.name, a]))` and replace both `.find` sites with `.get`. Wrap the sorted frequency rows in `useMemo` keyed on `affixHistory`.

## 5. Auto-balancer hi/lo extreme search re-scans RARITY_ORDER three times via reduce-with-index abuse
- **Severity**: low
- **Lens**: architecture
- **Category**: unclear flow / awkward abstraction
- **File**: src/lib/loot/auto-balancer.ts:64-65
- **Scenario**: `solveWeightsForTargetEV` finds the highest- and lowest-gold rarity indices using `RARITY_ORDER.reduce((best, _, i) => goldAt(i,...) > goldAt(best,...) ? i : best, 0)`, calling `goldAt` (itself an array index + object lookup) twice per element, for both `hi` and `lo`.
- **Root cause**: `reduce` is used purely for an argmax/argmin over indices while ignoring its accumulator value, which reads awkwardly and recomputes `goldAt(best,...)` on every step. The function is pure and tiny so this is a readability/clarity issue more than a hot-path cost.
- **Impact**: negligible runtime (RARITY_ORDER has 5 entries) but the double-`goldAt`-per-step argmax obscures the simple "pick the richest and poorest rarity" intent; a reader must decode the reduce to see it.
- **Effort**: 2 · **Value**: 2
- **Fix sketch**: precompute `const golds = RARITY_ORDER.map((_, i) => goldAt(i, rarityGold))` once, then derive `hi`/`lo` with a single `indexOf(Math.max(...golds))` / `Math.min` (5 elements, no spread risk) or a one-pass loop tracking both extremes. Clarifies intent and removes the redundant lookups.
