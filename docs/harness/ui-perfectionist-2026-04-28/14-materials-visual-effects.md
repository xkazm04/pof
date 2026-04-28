# UI Perfectionist — Materials & Visual Effects

> Context: Materials & Visual Effects (Content Creation)
> Files read: 8
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Two parallel post-process editors with divergent visual systems
- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/content/materials/PostProcessStackBuilder.tsx:51-148, src/lib/post-process-studio/effects.ts:11-163
- **Scenario**: `PostProcessStackBuilder` (used inside MaterialsView "Post-Process" tab) hard-codes its own list of 7 PP effects (`PP_EFFECTS`) with one shape, while `PostProcessStudioView` consumes a richer 10-effect catalog from `src/lib/post-process-studio/effects.ts` with different ids (`pp-bloom` vs `bloom`), different param schemas, different categories, and different visual treatments (techno-purple "COMPILE_VOLUME_SETTINGS" vs neutral SurfaceCard chrome). Bloom intensity, DOF f-stop, AO radius, Vignette etc. are duplicated with subtly different copy and ranges.
- **Root cause**: The materials-tab builder was authored before `post-process-studio` and never migrated; both modules now own competing sources of truth for the same UE5 PP subsystem.
- **Impact**: A user enabling Bloom in the Materials tab sees a different definition, range, and chrome from the Studio view. Future tweaks (new param, copy fix, GPU cost) must be applied twice and will drift.
- **Fix sketch**: Make `src/lib/post-process-studio/effects.ts` the single source of truth. Have `PostProcessStackBuilder` import `DEFAULT_EFFECTS` and the same `PPStudioEffect`/`PPStudioParam` types instead of redeclaring `PP_EFFECTS`/`PPEffect`. Extract a shared `<PPEffectRow>` and `<PPParamSlider>` (built from the studio version) and let the materials-tab use a "lite" prop combination (no GPU bar, no A/B). Delete `PP_EFFECTS` from `PostProcessStackBuilder.tsx`.

## 2. Three independent slider implementations across the surface
- **Severity**: High
- **Category**: Component Architecture / Design System
- **File**: src/components/modules/content/materials/MaterialParameterConfigurator.tsx:333-348, src/components/modules/content/materials/MaterialStyleTransfer.tsx:594-636, src/components/modules/evaluator/PostProcessStudioView.tsx:546-623
- **Scenario**: Three different range-slider visuals coexist within the Materials/PP surface area: (a) Configurator's gradient-fill native `<input type="range">` with min/max labels under the track, (b) StyleTransfer's `accent-amber-400` native input plus inline value/reset, (c) PP Studio's invisible-input + custom-thumb composite. Track heights (1px vs 1px vs 4px), thumb styling, modified-state colour cues, and value formatting all differ.
- **Root cause**: No shared `<Slider>` primitive; every editor invented its own at write time.
- **Impact**: Identical interactions feel different across tabs; thumb hit-targets and a11y (focus rings, keyboard handling) differ silently. Adds three places to keep in sync for theme changes.
- **Fix sketch**: Extract `src/components/ui/Slider.tsx` exposing `value/min/max/step/onChange/color/showLabels/showResetWhenModified`. Reuse the PP Studio composite (best a11y/visuals — invisible native input over rendered track+thumb) and migrate the other two call sites. Centralise `formatValue(step)` from PostProcessStudioView.tsx:836-841.

## 3. MaterialsView tab chrome violates the rest of the surface's design language
- **Severity**: High
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:258-290, src/components/modules/content/materials/MaterialPatternCatalog.tsx:296-318, src/components/modules/content/materials/PostProcessStackBuilder.tsx:249-273
- **Scenario**: LayerGraph, PatternCatalog and PostProcessStackBuilder ship a "techno" theme — `bg-surface-deep rounded-2xl border-violet-900/30`, `shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]`, blur-100 ambient blobs, the same 12×12 violet shadowed icon tile, and uppercase-tracked headings ("SHADER TREE COMPILER", "DATABASE_ENTRIES", "PRIORITY_ROUTING_LOCKED"). Sibling tabs `MaterialParameterConfigurator` and `MaterialStyleTransfer` use the calm in-app idiom (`var(--surface-deep)`, neutral borders, `text-text` headings, `MODULE_COLORS.content` accent). Switching tabs feels like switching apps.
- **Root cause**: Three editors were styled as theatrical "centerpieces" (likely demo-driven) while the others followed the project's standard tokens; nothing reconciled them.
- **Impact**: Breaks visual rhythm across the flow bar steps, fights the project-wide accent (`MODULE_COLORS.content`), and the hard-coded violet ignores per-category accent.
- **Fix sketch**: Pick one direction (the design-token idiom is dominant elsewhere). Replace the violet wrapper with `<SurfaceCard level={1}>` plus `accentColor={MODULE_COLORS.content}` for header/icon. If "techno" framing is wanted as an opt-in, extract a `<PanelShell variant="techno"|"default">` wrapper and gate it behind a project-wide flag — but do not hard-code violet hexes in three components.

## 4. Hard-coded raw rgba/violet hexes throughout — colour-token drift
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:258-263, MaterialPatternCatalog.tsx:297-300, PostProcessStackBuilder.tsx:250-253, MaterialPatternCatalog.tsx:344-347, PostProcessStackBuilder.tsx:382-390
- **Scenario**: These three files contain dozens of literal `rgba(139,92,246,…)`, `rgba(167,139,250,…)`, `rgba(10,10,25,0.6)`, `border-violet-900/30`, `bg-violet-600/10`, plus the inline data-URL noise SVG in LayerGraph. Category buttons in PatternCatalog still use template-string opacity (`${color}20`, `${color}50`) when a `withOpacity()` helper is already imported from `@/lib/chart-colors`.
- **Root cause**: Magic numbers crept in alongside the techno styling; no lint gate catches raw rgba/hex when chart-colour helpers exist.
- **Impact**: Theme tweaks (e.g., changing the violet brand) miss these files entirely; opacity steps drift (15/20/30/40/50 used inconsistently for the "active surface" treatment).
- **Fix sketch**: Define `OPACITY_*` constants for the recurring 04/08/10/15/20/30/40/50 steps in `chart-colors.ts` (some already exist — `OPACITY_15`, `OPACITY_30`). Replace `${color}20` with `withOpacity(color, OPACITY_15)` consistently. Replace the literal violet rgba()s with `withOpacity(ACCENT_VIOLET, OPACITY_*)` or a `--surface-techno-bg` token if the techno chrome stays.

## 5. GPU cost shown as raw numbers, not typed badges (and only in one place)
- **Severity**: Medium
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/evaluator/PostProcessStudioView.tsx:495-501, 642-670, src/components/modules/content/materials/PostProcessStackBuilder.tsx (no cost display)
- **Scenario**: PP Studio displays `gpuCost.toFixed(2)ms` inline as plain text on each EffectCard and again in the breakdown rows; over-budget rows colour-shift to amber/red via ad-hoc class strings. The materials-tab Post-Process builder shows no cost at all despite using the same UE5 effects. There is no shared "cost chip" with severity tiers (under/near/over).
- **Root cause**: Cost rendering was inlined per call site rather than abstracted to a `<GpuCostBadge ms budgetMs />` primitive that picks the colour band.
- **Impact**: Cost colour thresholds (`> budget*0.3` for "expensive", `> budget*0.75` for "approaching") are hard-coded inline and only enforced in PP Studio; visual signalling is inconsistent.
- **Fix sketch**: Extract `<GpuCostBadge value={ms} budget={budgetMs} variant="chip"|"row"|"total" />` returning an icon + formatted number with consistent thresholds (green/amber/red). Reuse it in both PostProcessStackBuilder (per row, even if summary only) and PostProcessStudioView.tsx:495-501/642-670/665-670. Co-locate the threshold constants with `gpu-estimator.ts`.

## 6. Pattern-catalog category colour ramps duplicated as `${color}NN` inline strings
- **Severity**: Medium
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/content/materials/MaterialPatternCatalog.tsx:40-44, 343-356, 416-422, 432-437, 446-449, 487-518, src/components/modules/content/materials/MaterialStyleTransfer.tsx:62-71, 401-407, 673-678, src/components/modules/content/materials/PostProcessStackBuilder.tsx:382-390, 419-419, 446-449
- **Scenario**: A "category pill" pattern (background `${color}15`, border `${color}30/40/50`, text `${color}`, sometimes a glow `boxShadow: 0 0 NNpx ${color}NN`) is reimplemented in five places with slightly different opacity stops. PatternCatalog uses 15/40/50, PostProcessStackBuilder uses 10/15/20/30/40/50, StyleTransfer surface chip uses 15/30. SURFACE_COLORS map in StyleTransfer duplicates the category→colour mapping that MaterialParameterConfigurator already owns.
- **Root cause**: No shared `<CategoryPill colour={accent} active={bool} />` or `surfaceColorOf(SurfaceType)` utility.
- **Impact**: Three categorisations of the same surface types diverge silently; tweaking the "active state" treatment requires editing each file.
- **Fix sketch**: (a) Move `SURFACE_COLORS` and `SURFACE_LABELS` from MaterialStyleTransfer into a shared `material-surfaces.ts` and import in both files (and in `MaterialParameterConfigurator`'s `SURFACES` array). (b) Extract `<AccentPill colour active>` and `<AccentChip colour glow>` into the design system — use existing `OPACITY_*` constants for the opacity steps.

## 7. Missing focus-visible ring on every custom button across these editors
- **Severity**: Medium
- **Category**: Accessibility-as-polish
- **File**: src/components/modules/content/materials/MaterialLayerGraph.tsx:366-389, MaterialPatternCatalog.tsx:339-354, 426-462, 508-555, PostProcessStackBuilder.tsx:299-344, 414-467, MaterialParameterConfigurator.tsx:201-217, 229-247, 262-290
- **Scenario**: Almost every interactive surface in these files is a `<button>` with `outline-none` (PatternCatalog generate/preview, PostProcessStackBuilder generate/preview) or no focus styling at all (NodeCard, EffectRow toggle/expand, surface tiles, feature toggles). Tab-keyboard navigation produces no visible focus indicator on any of these controls.
- **Root cause**: The techno styling explicitly removes outlines without adding `focus-visible:` replacements; the calm-style sibling components inherit the project default but never add an accent-aware focus ring.
- **Impact**: Keyboard users cannot see where focus is in a heavy parameter-tuning UI; accessibility regression that compounds across ~30 buttons.
- **Fix sketch**: Replace `outline-none` with `outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-deep` and pick the ring colour per accent (e.g., `focus-visible:ring-violet-400/60` for techno cards, `focus-visible:ring-[color:var(--accent-content)]` for calm cards). Bake this into the proposed shared button/pill primitives so it is applied once.

## 8. EffectRow expand-arrow duplicated inside same row (PP Studio)
- **Severity**: Low
- **Category**: Component Architecture / Polish
- **File**: src/components/modules/evaluator/PostProcessStudioView.tsx:481-509
- **Scenario**: The EffectCard has a primary `<button onClick={onExpand}>` wrapping the name+description, and immediately after it a separate small chevron button also wired to `onExpand` (`504-508`). Two adjacent controls performing the same action with slightly different hit-targets and no shared pressed/focus styling.
- **Root cause**: The chevron was likely added later as a visual affordance without removing the wrapping button (or vice versa).
- **Impact**: Confusing tab order (two sequential focus stops doing the same thing), slightly inflated DOM, inconsistent with PostProcessStackBuilder which has only one expand control per row.
- **Fix sketch**: Drop the trailing chevron button; render the chevron as a non-interactive `<span aria-hidden>` inside the wrapping button (right edge), matching the rotate-180 pattern used in PatternCatalog (line 454-461) and PostProcessStackBuilder (line 457-467). One control, one focus stop.
