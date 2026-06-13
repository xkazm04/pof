# Level & Materials Authoring — zen-perf scan
> Context: Visual Content Generation / Level & Materials Authoring
> Total: 5
> Severity: critical=0 high=2 medium=3 low=0

## 1. Two parallel, fully-duplicated post-process effect systems
- **Severity**: high
- **Lens**: both
- **Category**: duplication / SRP
- **File**: src/components/modules/content/materials/PostProcessStackBuilder.tsx:51 (and src/lib/post-process-studio/effects.ts:11)
- **Scenario**: Any time the team adds, renames, or re-tunes a post-process effect (e.g. a new "Lens Flare", a changed default for Bloom), or wants the materials-tab stack builder to show GPU cost.
- **Root cause**: The codebase ships two independent definitions of "the post-process effects". `PostProcessStackBuilder.tsx` hardcodes `PP_EFFECTS` (7 effects, UI-shaped types `PPEffect`/`PPStackEntry`, its own `moveEffect`/`EffectRow`/expand state) while `effects.ts` defines `DEFAULT_EFFECTS` (10 effects, the richer `PPStudioEffect` type with `gpuCostMs`, `plain` decoders, presets, and a real estimator). `PostProcessStudioView.tsx` + `postProcessStudioStore.ts` consume the second; the materials tab consumes the first. Same domain, two sources of truth, two reorder algorithms, two row components, two "compile" flows.
- **Impact**: Effect lists already disagree (7 vs 10 — the stack builder is missing DOF/exposure/chromatic-aberration/film-grain/fog). The stack builder has *zero* GPU cost estimation despite the context being explicitly "post-process stack builder with GPU cost estimation" — that capability already exists in `gpu-estimator.ts` but is unreachable from this surface. Every effect change must be made twice and they will keep drifting.
- **Effort**: 5 · **Value**: 8
- **Fix sketch**: Delete `PP_EFFECTS` and the bespoke types from `PostProcessStackBuilder.tsx`; derive its rows from `DEFAULT_EFFECTS` (map to the lightweight on/priority shape it needs) and surface `estimateGPUBudget` for the enabled subset so the materials tab shows the same budget the evaluator view does. Reuse `moveEffect` priority-swap logic from the store rather than reimplementing it.

## 2. `MaterialBudgetBar` recomputes the full cost report on every parent render
- **Severity**: medium
- **Lens**: performance
- **Category**: missing memoization
- **File**: src/components/modules/content/materials/MaterialBudgetBar.tsx:25
- **Scenario**: User drags any parameter slider or types in the bridge-connected configurator — `MaterialParameterConfigurator` re-renders on every `setParamValues`/`setFeatures`, re-rendering its `<MaterialBudgetBar>` child each time.
- **Root cause**: `estimateMaterialBudget({ surfaceType, features })` is called unconditionally in the render body with no `useMemo`. A fresh options object is passed each render, so even a memoized estimator could not cache. The configurator holds `paramValues` state that changes on every slider tick, forcing this child to re-run the whole sampler/instruction/warning computation though only `surfaceType`/`features` actually affect it.
- **Impact**: Sampler + instruction breakdown + warning synthesis runs on every keystroke/drag even though its inputs (`surfaceType`, `features`) rarely change during a drag. Wasted CPU and array allocation on the hot interaction path.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: `const report = useMemo(() => estimateMaterialBudget({ surfaceType, features }), [surfaceType, features]);`. Optionally wrap the component in `React.memo` so it skips re-render entirely when those two props are referentially stable.

## 3. `getSummary` deserializes every document's full JSON just to produce counts
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated DB work / O(rows × payload)
- **File**: src/lib/level-design-db.ts:123
- **Scenario**: The level-design summary panel / API loads aggregate stats (totalRooms, difficulty + room-type distribution, sync counts) as the doc library grows.
- **Root cause**: `getSummary()` calls `getAllDocs()` which does `SELECT *` and runs `JSON.parse` on `rooms`, `connections`, `difficulty_arc`, and `sync_report` for *every* row (`rowToDoc`, line 41-58), then `flatMap`s all rooms into one array purely to count by difficulty/type and tally sync statuses. The heavy `connections`/`difficultyArc`/`syncReport` parses are pure waste here — they are never read by the summary.
- **Impact**: Summary cost scales with total stored JSON payload, not with the small set of numbers it returns. With many docs each holding large `rooms`/`connections` arrays, this parses megabytes per call to emit a handful of integers.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Compute counts in SQL where possible (`SELECT COUNT(*)`, `GROUP BY sync_status`). For room distributions that need JSON, select only `rooms` (`SELECT rooms FROM level_design_docs`) and parse that single column, skipping connections/difficultyArc/syncReport entirely. Avoid building the giant `allRooms` array — accumulate counts in the parse loop.

## 4. Material hierarchy lock state hardcodes a single dependency label and a brittle index contract
- **Severity**: medium
- **Lens**: architecture
- **Category**: hardcoded coupling / unclear flow
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:252
- **Scenario**: Editing the `NODES` graph — adding a tier, re-rooting, or giving a child a different prerequisite than `mt-3`.
- **Root cause**: The lock UI prints a literal `DEP_MISSING: mt-3` (line 252) regardless of which dependency is actually missing, while the real prerequisite check (`node.dependencies.every(...)`, line 77) is data-driven. The renderer also assumes `nodeStates[0]` is the root and `slice(1)` are exactly two side-by-side children (lines 85-86, 144-165) with a fork drawn for precisely two branches. The data model (`tier`, `dependencies[]`) promises generality the view does not honor.
- **Impact**: Any change to the node set silently produces a wrong "missing dependency" message or a broken fork layout. Misleading UX and a latent maintenance trap; the structured `dependencies` field is effectively dead because the display ignores it.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Derive the locked message from the node's first unmet dependency (`node.dependencies.find(d => !progress[d])`) and map its id to its label. Either render children generically from `tier` (drop the 2-child fork assumption) or document/enforce the 3-node contract instead of leaving the data model open-ended.

## 5. Spatial-diagram arrow endpoints mix percent coords with fixed aspect-blind offsets
- **Severity**: medium
- **Lens**: architecture
- **Category**: fragile geometry / unclear flow
- **File**: src/components/modules/content/level-design/LevelDesignSpatialDiagram.tsx:182
- **Scenario**: The level-systems diagram renders at any container width other than the one it was eyeballed at, or the `min-h-[200px]`/`height:240` ratio changes.
- **Root cause**: Arrow start/end points are computed in percentage space (`fromNode.x`, `fromNode.y`) but offset by `nodeHalfWPct = 18` / `nodeHalfHPct = 18` "percentage units" that the inline comments themselves flag as "approximate since we're mixing percentage layout" (lines 182-187). Percent-X and percent-Y are not the same pixel distance unless the box is square, so the 18%-each offset only lines up with the `NODE_W=168 / NODE_H=88` cards at one specific container size. The unit-vector math `(nx, ny)` further assumes isotropic axes.
- **Impact**: Dependency arrows detach from or overshoot node edges as the panel resizes — purely cosmetic but the kind of "approximate" geometry that quietly rots. `NODE_W`/`NODE_H` constants (lines 75-76) are declared for "arrow endpoint calculations" yet never used in that math, signalling the offset was never actually derived from node size.
- **Effort**: 4 · **Value**: 3
- **Fix sketch**: Measure the container with a ref (or render arrows in a fixed pixel viewBox keyed to known node-center pixels) and offset endpoints in real px using `NODE_W/2`,`NODE_H/2`, projecting along the true pixel-space direction rather than percent-space. Remove `NODE_W`/`NODE_H` if they stay unused.
