# Layout Lab & Pipeline Steps — zen-perf scan
> Context: Catalog to UE Pipeline / Layout Lab & Pipeline Steps
> Total: 5
> Severity: critical=0 high=2 medium=3 low=0

## 1. `useEntityArtifacts` memo is busted every render for non-Items catalogs (full rollup recompute)
- **Severity**: high
- **Lens**: performance
- **Category**: missing-memoization / wasted-recompute
- **File**: src/components/layout-lab/Baseline.tsx:78 (and src/components/layout-lab/hooks/useEntityArtifacts.ts:90)
- **Scenario**: Any non-`items` catalog selected (bestiary, spellbook, currencies, every StepSpec catalog). Every render of `Baseline` — including unrelated state flips like `plainMode`, `draining`, drawer open/close, a viewport resize, or a parent re-render — recomputes the entire artifact rollup.
- **Root cause**: `steps` is built as `pipeline.steps.map((s) => s.label)` (Baseline.tsx:78-80), producing a **brand-new array reference every render** for non-Items catalogs. That array is passed straight into `useEntityArtifacts(..., steps, ...)`, whose `useMemo` deps are `[catalogId, entity, steps, entitySteps, serverArts]` (useEntityArtifacts.ts:91-93). A fresh `steps` identity defeats the memo, so `deriveEntityArtifacts` re-runs in full each render. (Items is accidentally safe because it uses the memoized `detail.steps`.)
- **Impact**: `deriveEntityArtifacts` does `steps.filter(...).map(...)` calling `resolveAccept` per step (which itself walks the pipeline — see finding #2), rebuilds the `artifactByStep` Map, and re-closes `displayStatus`/`stepDone` on every keystroke-level re-render. O(steps) acceptance evaluation wasted on every interaction.
- **Effort**: 2 · **Value**: 7
- **Fix sketch**: Memoize the derived `steps` array in Baseline — `const steps = useMemo(() => (catalogId !== 'items' && pipeline) ? pipeline.steps.map(s => s.label) : (detail?.steps ?? []), [catalogId, pipeline, detail?.steps])`. With a stable `steps` identity the existing `useEntityArtifacts` memo holds.

## 2. `deriveEntityArtifacts` resolves acceptance with an O(steps²) registry walk
- **Severity**: high
- **Lens**: performance
- **Category**: O(n^2) algorithm
- **File**: src/components/layout-lab/hooks/useEntityArtifacts.ts:52-62 (via src/components/layout-lab/labAcceptance.ts:23)
- **Scenario**: Hydrated entity with most/all steps produced on any StepSpec catalog (e.g. spellbook = 16 steps). Each rollup derivation calls `resolveAccept(catalogId, s)` once **per step inside the `.map`**.
- **Root cause**: For non-Items catalogs, `resolveAccept` does `getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step)` (labAcceptance.ts:23) — a linear scan of the pipeline's step list. Called once per step over N steps that's O(N²). The pipeline lookup + linear `find` is repeated for every step on every derivation, and combined with finding #1 it runs on every render.
- **Impact**: Quadratic acceptance resolution per rollup. Small N today (≤16) so not catastrophic, but it is pure waste multiplied by the per-render recompute, and it scales badly if pipelines grow. The Map of `label → step` could be built once.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Build a per-catalog `Map<label, StepSpec>` once (memoized by catalogId, or cached in `pipeline-registry`) and have `resolveAccept` do an O(1) lookup. Or hoist a single `resolveAccept`-bound checker map inside `deriveEntityArtifacts` keyed by step before the `.map`.

## 3. `PipelineRollup.tsx` is dead production code (149 lines, only referenced by its test)
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead-code
- **File**: src/components/layout-lab/PipelineRollup.tsx:41
- **Scenario**: Maintenance — the component carries the status-chip + drain-button + disclosure logic, but no production component renders it. The drain UI + rollup summary were relocated into `NextStepCoach` (see the comment at NextStepCoach.tsx:23: "relocated here from the old in-canvas PipelineRollup").
- **Root cause**: The only import of `PipelineRollup` is `src/__tests__/components/layout-lab/statusChips.test.tsx:11`; no `.tsx`/`.ts` under `src/` outside tests imports it. The file is a self-contained 149-line component plus helpers (`stepTooltip`, `recoverTestName`) that now duplicate logic living in `useEntityArtifacts`/`NextStepCoach`/`labGlossary`.
- **Impact**: Carrying cost — a second, independent implementation of "per-step status chip + tier + reason tooltip" that can silently drift from the live `displayStatus` path; the test gives false confidence that the UI is wired. ~149 LOC removable.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Delete `PipelineRollup.tsx` and its test (or repoint the WCAG status-chip assertions at the real `PipelineRail`/`NextStepCoach` rendering). Confirm `recoverTestName`/`stepTooltip` have no other consumer before removing.

## 4. `useViewportWidth` re-renders the whole `Baseline` tree on every resize pixel
- **Severity**: medium
- **Lens**: performance
- **Category**: unnecessary-re-render
- **File**: src/hooks/useViewportWidth.ts:28 (consumed at Baseline.tsx:62-63)
- **Scenario**: User drags the window edge or any layout reflow fires the `ResizeObserver`. Each callback calls `setWidth(window.innerWidth)` with the raw pixel value.
- **Root cause**: The hook stores and returns the exact width, but `Baseline` only uses the **boolean** `viewportWidth >= COLLAPSE_BREAKPOINT` (Baseline.tsx:63). Every sub-pixel/continuous resize event sets new state and re-renders `Baseline` and its entire subtree (CatalogTree, PipelineRail, the step canvas, ArchetypeStep with its per-render `spec.accept`/`spec.produce` calls), even though the layout-relevant boolean only flips at one threshold.
- **Impact**: A resize-drag triggers a storm of full re-renders of the heaviest screen in the lab, each re-running the rollup derivation (compounded by findings #1/#2). No debounce, no threshold quantization.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Add a `useMediaQuery`/threshold-aware variant that only updates when the boolean changes (`setWide((prev) => prev === next ? prev : next)` inside the observer), or expose `useViewportWide(breakpoint)` returning the boolean. Avoids re-rendering on every intermediate width.

## 5. `CatalogTree` recomputes `visibleCatalogs` and does O(n²) `indexOf` lookups inside its render map
- **Severity**: medium
- **Lens**: both
- **Category**: missing-memoization / O(n^2)
- **File**: src/components/layout-lab/CatalogTree.tsx:148-149, 204
- **Scenario**: Every render of the tree (selection change, parent re-render, resize storm from finding #4). `visibleCatalogs = groups.flatMap(...)` and `findIndex` rebuild each render, and inside the JSX `group.catalogs.map` each row calls `visibleCatalogs.indexOf(catalog)` (CatalogTree.tsx:204).
- **Root cause**: `visibleCatalogs.indexOf(catalog)` is a linear scan executed once per rendered catalog row → O(catalogs²) per render. None of `selectedCategory`, `visibleCatalogs`, or `activeIdx` are memoized, so they recompute on every re-render even when `groups`/`selectedCatalogId` are unchanged.
- **Impact**: Quadratic per-render cost in the always-mounted left rail; multiplied by the unthrottled resize re-renders (finding #4). Modest catalog counts keep it cheap today, but it is gratuitous and the index could be carried alongside `visibleCatalogs` in one pass.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: `useMemo` `visibleCatalogs` (deps: `groups`, `override`, `selectedCategory`) and build a `Map<catalogId, index>` in the same pass; replace the inline `indexOf` with a Map lookup. Optionally memoize `selectedCategory`/`activeIdx` off the same inputs.
