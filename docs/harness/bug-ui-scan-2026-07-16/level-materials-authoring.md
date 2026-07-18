# Level & Materials Authoring — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Surface switch silently discards all tuned parameter overrides
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/materials/MaterialParameterConfigurator/useMaterialParameterConfigurator.ts:34-43
- **Scenario**: User selects "Glass", tweaks IOR to 2.1 and Opacity to 0.3, then clicks "Water" to compare, then clicks back to "Glass".
- **Root cause**: `selectSurface` unconditionally replaces `paramValues` with `{ Roughness: getDefaultRoughness(s), Metallic: getDefaultMetallic(s) }`, dropping every other applicable param (Opacity, IOR, EmissiveIntensity, SubsurfaceRadius, ParallaxDepth) that the user may have already set for that or any other surface.
- **Impact**: Careful manual tuning is silently lost the moment the user explores a different surface tab and returns — no warning, no undo, and the slider UI shows the reset default as if nothing happened.
- **Fix sketch**: Key `paramValues` per surface (`Record<SurfaceType, Record<string,number>>`) or only reset params that are not defined for the new surface, preserving values for params shared across surfaces / previously set per-surface state.

### 2. Style-transfer analysis errors fail completely silently
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer.ts:72-96
- **Scenario**: The `/api/style-transfer` call throws (network drop, 500, malformed JSON) or returns `{ success: false }` (e.g. rejected image, quota error).
- **Root cause**: The `catch` block is empty except for a comment ("Silently fail — user can retry"), and the `if (json.success)` branch has no `else` — both failure paths leave `analysis` at `null` and only reset `isAnalyzing`.
- **Impact**: The button reverts from "Analyzing..." back to "Analyze Reference" with zero feedback. The user has no idea whether the request failed, was rejected, or is still "thinking" — classic success-theater/caught-and-forgotten failure that looks identical to a no-op click.
- **Fix sketch**: Track an `analyzeError` state, surface it in an inline error banner (mirroring the `generateError` pattern already used in `PostProcessStackBuilder` and `BiomeScatterPanel`), and branch on `json.success === false` to show the server-provided error message.

### 3. Drag-and-drop upload path skips size validation and stale-override cleanup
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer.ts:49-60
- **Scenario**: User drags a 40MB screenshot onto the drop zone, or drops a second reference image after already tweaking Roughness/Metallic/Emissive overrides for a prior image.
- **Root cause**: `handleDrop` only checks `file.type.startsWith('image/')` — unlike `handleFileSelect` it never checks `file.size > 10 * 1024 * 1024`, and it never resets `overrideRoughness`/`overrideMetallic`/`overrideEmissive`/`overrideSurface` the way `handleFileSelect` and `handleClearImage` do.
- **Impact**: Oversized images can be dropped (inconsistent with the "PNG, JPG up to 10MB" copy shown to the user) and previous manual overrides silently carry over and get blended into the *new* image's analysis via `effectiveAnalysis`, producing a material that matches neither reference.
- **Fix sketch**: Extract the shared validate+reset logic from `handleFileSelect` into a helper and call it from both `handleFileSelect` and `handleDrop`.

### 4. Post-process effect stack has two independent, divergent sources of truth
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/content/materials/PostProcessStackBuilder/index.tsx:33 vs src/components/modules/evaluator/PostProcessStudioView/index.tsx:25-56
- **Scenario**: A user opens Materials → Post-Process tab, disables Bloom and reorders Vignette above Color Grading, then separately opens the Evaluator's Post-Process Studio.
- **Root cause**: `PostProcessStackBuilder` keeps its own local `useState<PPStudioEffect[]>(cloneDefaultEffects)` completely disconnected from `usePostProcessStudioStore`, which `PostProcessStudioView` reads/writes. The two views share the same effect types, the same `estimateGPUBudget` estimator, and nearly identical row UI, but never share state. `PostProcessStackBuilder` also hardcodes `TARGET_RESOLUTION = '1080p'` while the Studio view's resolution is user-selectable (`resolution` from the store) and persisted.
- **Impact**: Edits in one screen never appear in the other; GPU budget numbers shown for "the same" stack can legitimately differ between screens because the resolution assumption differs. Users reasonably assume "Post-Process" is one coherent state.
- **Fix sketch**: Route `PostProcessStackBuilder` through `usePostProcessStudioStore` (or a shared slice) instead of local `cloneDefaultEffects` state, and pull `TARGET_RESOLUTION` from the store's `resolution`.

### 5. Locked-node "missing dependency" label is hardcoded, not derived from the node's actual dependencies
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:250-253
- **Scenario**: Today this happens to be harmless because the only two locked nodes (`mt-1`, `mt-2`) both depend solely on `mt-3`. But the label is written as a literal string, not computed.
- **Root cause**: `<Lock/> DEP_MISSING: mt-3` is a hardcoded JSX literal inside `NodeCard`, rather than being derived from `node.dependencies.filter(d => !progress[d])`.
- **Impact**: A time bomb — the next tier added to `NODES` (e.g. a node depending on `mt-1` instead of `mt-3`) will render an incorrect/misleading "DEP_MISSING: mt-3" message even though the actual missing prerequisite is different, silently confusing whoever extends this graph.
- **Fix sketch**: Compute `const missing = node.dependencies.filter((d) => !progress[d]);` in `nodeStates` and render `DEP_MISSING: {missing.join(', ')}`.

## UI findings

### 6. Configurator grids have no responsive breakpoints
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/materials/MaterialParameterConfigurator/index.tsx:102, 166
- **Scenario**: The panel is opened on a narrower side-panel width or a tablet-sized viewport (this app is used inside resizable docked panels, not just full-bleed desktop).
- **Root cause**: `SURFACES` (8 items) is rendered `grid-cols-4` and `FEATURES` (6 items) `grid-cols-2` with no `sm:`/`md:` variants anywhere in the file, unlike other parts of the codebase that do use responsive prefixes (e.g. `MaterialPatternCatalog`'s `xl:flex-row`).
- **Impact**: At narrow container widths, the 4-column surface icons and 2-column feature toggles compress into cramped, truncated buttons (labels already use `truncate`/`line-clamp`), degrading legibility and touch target size.
- **Fix sketch**: Add responsive column counts (e.g. `grid-cols-2 sm:grid-cols-4` for surfaces, `grid-cols-1 sm:grid-cols-2` for features) consistent with the `xl:` pattern already used in sibling components.

### 7. Spatial diagram mixes fixed-pixel node cards with percentage-based positions
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/level-design/LevelDesignSpatialDiagram/index.tsx:117-125, constants.ts:50-51
- **Scenario**: The diagram container is `max-w-lg` (responsive width) but each node card has a fixed `width: 168px, height: 88px` (`NODE_W`/`NODE_H`), while arrow endpoints are computed using hardcoded `nodeHalfWPct = 18` / `nodeHalfHPct = 18` percentages of container width.
- **Root cause**: The arrow-endpoint offset assumes one specific container-to-card size ratio; because the card is a fixed pixel size and the container width is fluid (percentage-based `x`/`y` too), the 18% offset is only correct at one particular rendered width.
- **Impact**: At other viewport/container widths the SVG connector lines drift away from the actual card edges (visibly disconnected or overlapping arrows), and on narrow containers the 168px-wide cards can start to overlap each other since their percentage-based centers don't leave a 168px gap.
- **Fix sketch**: Measure actual card dimensions via `ResizeObserver`/refs instead of a hardcoded percentage constant, or switch the whole diagram to a fixed-pixel/SVG viewBox coordinate system instead of mixing px cards with % positions.

### 8. Two divergent visual languages for the same "effect stack" concept
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/materials/PostProcessStackBuilder/EffectRow.tsx vs src/components/modules/evaluator/PostProcessStudioView/EffectCard.tsx
- **Scenario**: A user works with the Materials tab's Post-Process builder (glowing violet "shader compiler" cyberpunk theme, `bg-[#03030a]`, neon borders, `COMPILING_SHADER...` copy) and later opens the Evaluator's Post-Process Studio (standard `SurfaceCard`, design-token-driven `bg-surface-deep`, plain "ON/OFF" toggle).
- **Root cause**: `EffectRow` and `EffectCard` independently re-implement almost the same feature (toggle, reorder, GPU cost chip, expandable params) with entirely different token usage — one hardcodes raw hex/rgba colors and a "hacker terminal" aesthetic, the other uses the app's semantic CSS variables (`var(--border)`, `SurfaceCard`).
- **Impact**: Breaks visual consistency across two screens that represent conceptually identical data, increases maintenance cost (any shared fix — like the a11y "ON/OFF" cue — has to be applied twice), and signals to users they're looking at two unrelated features rather than one.
- **Fix sketch**: Extract one shared `EffectRow`/`EffectCard` primitive parameterized by an optional theme/accent prop, or standardize both on the app's semantic design tokens and retire the bespoke cyberpunk skin (or apply it consistently to both).

### 9. Locked graph nodes are clickable, focusable buttons with no disabled semantics
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:194-196, src/components/modules/content/level-design/LevelDesignSpatialDiagram/index.tsx:162-165
- **Scenario**: A keyboard or screen-reader user tabs to a locked node (e.g. "Dynamic Materials" before "Master Material" is complete).
- **Root cause**: The native `disabled` attribute is only `isRunning && !isActive` — it does not account for `locked`. The locked/no-op behavior is enforced purely inside the `onClick` handler (`if (locked || isRunning) return;`), so the button remains focusable and is announced as an enabled, clickable control despite the grayscale "locked" visual treatment sighted users rely on.
- **Impact**: Keyboard/AT users get no indication the control is inert until after activating it and observing nothing happens; this also means locked cards participate in tab order ahead of the currently-actionable node, adding friction.
- **Fix sketch**: Add `disabled={locked || (isRunning && !isActive)}` (and `aria-disabled` if a non-`<button>` wrapper is ever used) so the locked state is exposed natively, matching the pattern already used for `isRunning`.
