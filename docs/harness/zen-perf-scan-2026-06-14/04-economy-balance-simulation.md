# Economy & Balance Simulation — zen-perf scan
> Context: Items, Loot & Economy / Economy & Balance Simulation
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `computeMetrics` runs a full sort + double reduce every hour, then ~half the results are discarded
- **Severity**: high
- **Lens**: performance
- **Category**: hot-path waste
- **File**: src/lib/economy/simulation-engine.ts:74-77 (call site) → :301-329 (`computeMetrics`)
- **Scenario**: Any non-trivial run. With the config-panel maxima (agentCount=500, maxPlayHours=200) the engine computes 200 hourly `EconomyMetrics`, each doing `agents.map(...).sort(...)` (O(n log n)) plus two full `agents.reduce(...)` passes over `totalGoldEarned`/`totalGoldSpent`.
- **Root cause**: Metrics are computed unconditionally for every hour, but `buildMetricsArray` (:346-358) immediately throws most of them away — it samples `step = floor(maxHours/100)`, so for maxHours=200 only every 2nd hour survives. Half the sorts/reductions feed a `metricsMap` entry that is never read. The two reductions also re-walk all agents from scratch each hour instead of carrying running totals (each agent already tracks cumulative earned/spent on its own state).
- **Impact**: ~200 sorts of 500-element arrays + 400 full-roster reductions per run, roughly half of them pure waste. This is the dominant per-hour cost after `trackSupplyDemand`, and it scales with `agentCount × maxPlayHours`.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Compute the sample `step` up front and only call `computeMetrics` on hours that will survive `buildMetricsArray` (or on level transitions). Maintain a running `totalEarned`/`totalSpent` accumulator updated in the agent loop instead of re-reducing the whole roster each sampled hour. The sort is only needed for median/min/max — keep it, but only on sampled hours.

## 2. `trackSupplyDemand` iterates the full item list per-agent-per-hour with Map get/set churn
- **Severity**: high
- **Lens**: performance
- **Category**: O(n) inner loop / allocation churn
- **File**: src/lib/economy/simulation-engine.ts:70 (call site) → :278-297
- **Scenario**: Every simulated hour, for every agent, the function loops over all 21 `DEFAULT_ITEMS`, and for each eligible item does a `Map.get` + object spread fallback + `Map.set`. At 500 agents × 200 hours × 21 items that is ~2.1M Map round-trips and `rng()` calls — the single largest iteration count in the engine.
- **Root cause**: Accumulation is keyed by `${level}-${category}` but recomputed per item even though all items of a category collapse to the same bucket; the `accum.get(key) ?? {…}` pattern allocates a throwaday literal on every hit, and `accum.set(key, entry)` is redundant once the entry exists (the object is mutated in place). Supply/demand only needs per-(level,category) aggregates, so per-item granularity is wasted work.
- **Impact**: Multi-million-iteration hot path dominated by Map hashing and short-lived object allocation; directly inflates `durationMs` shown in the UI banner and blocks the request thread (synchronous in the API route).
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Pre-group items by category once (outside the hour loop). Drop the `?? {…}` allocation by ensuring the entry exists then mutating without re-`set`. Better: aggregate per (level, category) directly rather than per item, multiplying by item count, so the inner loop shrinks from 21 items to 5 categories.

## 3. `buildSupplyDemand` recomputes the identical per-level `avgGold` five times and re-filters all agents each pass
- **Severity**: medium
- **Lens**: both
- **Category**: redundant computation / O(level×category×agents)
- **File**: src/lib/economy/simulation-engine.ts:493-513
- **Scenario**: After the main loop, for every level (1..maxLevel, up to 100) × 5 categories, the code runs `agents.filter((a) => a.level >= level).reduce(...)`. The resulting `avgGold` does **not** depend on `cat`, yet it is recomputed inside the category loop — 5× per level — each time re-filtering and re-reducing the entire agent array.
- **Root cause**: Loop nesting places a category-independent quantity (`avgGold`) inside the category loop. Same redundant-`agents.filter` anti-pattern that was already fixed once in `runItemEconomySim` via the `agentsAtOrAbove` precompute (item-economy-engine.ts:349-352) — that lesson wasn't applied here.
- **Impact**: maxLevel × 5 × agentCount filter+reduce passes (100×5×500 = 250k agent walks) where maxLevel × agentCount (50k) would suffice — a 5× overdraw on a post-loop pass.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Hoist the `avgGold` computation out of the `for (const cat …)` loop so it runs once per level. Optionally reuse the `agentsAtOrAbove`-style precompute already proven in item-economy-engine.ts to avoid re-filtering per level.

## 4. `GoldFlowChart` recomputes `Math.max(...sampled.map(...))` inside the render map — O(n²)
- **Severity**: medium
- **Lens**: performance
- **Category**: React render / O(n²)
- **File**: src/components/modules/evaluator/EconomySimulatorView.tsx:578-580
- **Scenario**: In the "Avg Gold Accumulation" strip, `const maxGold = Math.max(...sampled.map((s) => s.avgGold), 1)` is declared **inside** the `sampled.map((m, i) => …)` callback, so the full max scan re-runs for every bar rendered.
- **Root cause**: A loop-invariant (the max over `sampled`) is computed per iteration instead of once before the map. `sampled` is capped near ~20 points so the absolute cost is small, but it is textbook O(n²) and re-runs on every component render (the chart isn't memoized).
- **Impact**: Low wall-clock cost today (~20² spreads) but a latent footgun if the sample cap grows, and a clear correctness-of-intent smell. Cheapest fix in this set.
- **Effort**: 1 · **Value**: 4
- **Fix sketch**: Move the `maxGold` computation above the `.map` (next to the existing `maxFlow` calc at :512). While there, consider wrapping the chart subcomponents in `memo` since they only change when `metrics` changes.

## 5. `PHILOSOPHY_MODS` table is duplicated verbatim across the engine and the codegen module
- **Severity**: low
- **Lens**: architecture
- **Category**: duplication / single-source-of-truth
- **File**: src/lib/economy/simulation-engine.ts:19-23 and src/lib/economy/codegen.ts:31-35
- **Scenario**: The faucet/sink/drop multipliers per philosophy are defined identically in two files. codegen.ts even re-imports `applyFlowOverrides` from the engine (codegen.ts:12) to stay in sync on flow handling, but keeps its own private copy of the multiplier table.
- **Root cause**: No shared home for the philosophy constants. `definitions.ts` already owns the other economy constants (`DEFAULT_FAUCETS`, `DEFAULT_SINKS`, `DEFAULT_ITEMS`, `DEFAULT_CONFIG`) and is imported by both modules — the natural single source.
- **Impact**: A future tuning change (e.g. adjusting `scarcity-based` dropMul) must be made in two places; drift would silently desync the generated UE5 DataAsset from the simulation it was "calibrated" from — the exact invariant the codegen comment at :43-45 claims to protect.
- **Effort**: 1 · **Value**: 3
- **Fix sketch**: Move `PHILOSOPHY_MODS` into `definitions.ts` (or a tiny `philosophy.ts`) and import it in both `simulation-engine.ts` and `codegen.ts`, deleting the local copies.
