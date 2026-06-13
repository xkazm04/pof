# Abilities & GAS System — zen-perf scan
> Context: Character & Combat Authoring / Abilities & GAS System
> Total: 5
> Severity: critical=0 high=2 medium=3 low=0

## 1. `spellbookData` recomputes all 7 live transforms on every sync-state toggle
- **Severity**: high
- **Lens**: performance
- **Category**: re-render
- **File**: src/components/modules/core-engine/sub_ability/index.tsx:75-111
- **Scenario**: While a UE5 source sync is in flight (`useUE5SourceSync`), `isSyncing` flips true→false at least twice per refresh. The `spellbookData` `useMemo` lists `isSyncing` in its dependency array (line 111), yet `isSyncing` is only used to set a boolean flag on the returned object (lines 96, 98). Every toggle therefore re-runs `buildLiveAttributes`, `buildLiveTagDeps`, `buildLiveTagUsageFrequency`, `buildLiveTagTree`, `buildLiveAbilityRadar`, `buildLiveCooldownAbilities`, and `buildLiveTagDetailMap` against the (unchanged) `liveData.abilities`/`liveData.tags`.
- **Root cause**: The memo conflates a cheap presentational flag (`isSyncing`) with expensive data derivation. Because `spellbookData` is the value of `SpellbookDataCtx.Provider` (line 122), every recompute also creates a new context object, cascading re-renders into every consumer — most importantly `useSpellbookSearchIndex` (finding #3), which rebuilds the entire search index on the new `data` identity.
- **Impact**: Multiple full re-derivations of the whole spellbook dataset per sync, plus a context-wide re-render storm, on every refresh — with no visible change in the data the transforms produce.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Split the derivation from the flags. Compute the heavy `buildLive*` structures in a `useMemo` keyed only on `[liveData, refresh]`, then spread `{ isLive, isSyncing, parsedAt, refresh, ...derived }` into the provider value in a separate, cheap memo keyed on `[derived, isSyncing]`. `isSyncing` flips no longer touch the transforms.

## 2. Search index rebuilt + full substring scan on every keystroke, no debounce
- **Severity**: high
- **Lens**: performance
- **Category**: re-render
- **File**: src/components/modules/core-engine/sub_ability/SpellbookSearch.tsx:19-26
- **Scenario**: The palette filters by running `terms.every(t => r.label.toLowerCase().includes(t) || r.category.includes(t))` over the *entire* index on every keystroke (lines 23-25), re-lowercasing every label per term per keystroke. The source index comes from `useSpellbookSearchIndex` (spellbook-search-index.ts:45-118), whose `useMemo` is keyed on the context `data` object — which finding #1 makes a fresh identity on each sync, throwing away and rebuilding the whole index (sections, tag detail map, recursive `flattenTags`, radar, cooldowns, combos, attributes, effects, dep nodes, plus a `Set`-based de-dupe pass).
- **Root cause**: No memo of the lowercased label per result, no input debounce, and an index whose memo key (`data`) is unstable. Filtering and indexing are both O(index) and both fire far more often than the user types.
- **Impact**: On a live-synced spellbook the index can rebuild mid-typing (dropping/rebuilding results), and each character re-scans + re-lowercases the full list. Janky search on larger tag/ability sets.
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Stabilize the index memo (fix #1 so `data` identity is stable, or memo on the underlying arrays). Precompute `labelLower` once per `SearchResult` when the index is built. Debounce `query` (~120 ms) before filtering, or at minimum keep the lowercased haystack on the result object so the filter does plain `includes` without re-lowercasing.

## 3. `ensureTable()` runs `CREATE TABLE IF NOT EXISTS` on every GET and every upsert
- **Severity**: medium
- **Lens**: both
- **Category**: n+1-query
- **File**: src/lib/ability/ability-spec-db.ts:29,38,5-16
- **Scenario**: Both `getSpec` (line 29) and `upsertSpec` (line 38) call `ensureTable()` first, which executes a multi-line `CREATE TABLE IF NOT EXISTS ability_specs (...)` via `getDb().exec(...)`. Every `/api/ability-spec` GET (route.ts:13) and POST (route.ts:35) therefore issues a DDL statement before the real query. Opening an entity in the editor fires a GET per entity, so DDL is re-parsed and re-checked on every entity open and every optimistic save.
- **Root cause**: Schema bootstrap is co-located with the per-call data path instead of running once at module init / migration time. `exec` re-parses the DDL each call even though the table already exists after the first.
- **Impact**: Redundant DDL parse + catalog lookup on every ability-spec request; also couples the data-access layer to schema creation (a migration concern), making the table invisible to the project's migration registry.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Guard with a module-level `let ensured = false;` so `ensureTable()` is a no-op after the first call, or move the `CREATE TABLE` into the project's migration set and drop `ensureTable` from the hot path entirely.

## 4. Damage pipeline duplicated between `damage-formula.ts` and the simulator
- **Severity**: medium
- **Lens**: architecture
- **Category**: duplication
- **File**: src/lib/ability/damage-formula.ts:10-15
- **Scenario**: `calculateDamage` implements `scaled = base·(1+power/100)`, `afterArmor = scaled·(1 - armor/(armor+100))`, then crit scaling (lines 11-14). The GAS balance simulator's `rollDamage` (gas-balance/simulation.ts:27-34) re-implements the identical scaled-damage and armor-mitigation math line-for-line, differing only in deterministic-expected vs. random crit. The armor-mitigation term `armor/(armor+100)` is *also* re-derived a third time inline in gas-balance/index.tsx:135 and in `computeResults` (simulation.ts:110).
- **Root cause**: The "GAS damage model" was extracted into `damage-formula.ts` for the Spellbook Logic preview but the simulator and the summary panel each kept their own copy instead of importing it. The comment on `damage-formula.ts:2-9` even claims to be the canonical model.
- **Impact**: A balance change to the armor curve or power scaling must be edited in 3+ places; they can silently diverge so the designer-facing preview disagrees with the Monte Carlo results — exactly the kind of trust-eroding mismatch this tooling exists to prevent.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Export a shared `scaleAndMitigate(base, power, armor)` (and an `armorMitigation(armor)` helper) from `damage-formula.ts`; have `calculateDamage`, `rollDamage`, `computeResults`, and the index.tsx summary all call it. Keep crit-roll vs. expected-crit as thin wrappers around the shared core.

## 5. HistogramChart re-renders every bar on every hover; index-based keys
- **Severity**: medium
- **Lens**: performance
- **Category**: re-render
- **File**: src/components/modules/core-engine/sub_ability/gas-balance/HistogramChart.tsx:22-52
- **Scenario**: `hoveredIdx` is component state (line 17); moving the mouse across the bar strip fires `setHoveredIdx` on every `onMouseEnter` (line 30), re-rendering the whole `bins.map` and re-evaluating each bar's inline `style` object — including the `opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1` branch (line 38) and a per-bar `<motion.div>` with `animate={{ height }}` (lines 41-42). With the simulator's histograms (TTK / DPS distributions, dozens of buckets) every pixel of cursor travel re-runs the full map and can retrigger the entrance animation. Bars are also keyed by array index (`key={i}`, line 28), so any bin-count change reuses DOM nodes incorrectly.
- **Root cause**: Hover highlight is handled by re-rendering all bars from a single parent state instead of CSS-driven dimming, and the animated bar shares a component with the hover-reactive style.
- **Impact**: O(bins) React work per mouse move over the chart, plus animation restarts; visible jank on a hot, interactive analysis surface.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Move the dim-others effect to CSS (e.g. a `group-hover` / `peer` pattern, or `.bar:hover ~ .bar { opacity }`) so hover does not touch React state; or extract a memoized `Bar` and pass `dimmed` only to the affected bars. Key bars by `bin.low`/range rather than index. Run the entrance `animate` once (gate with a mount ref) so re-renders don't re-animate.
