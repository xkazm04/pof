# UI Perfectionist — UI/HUD & Models

> Context: UI/HUD & Models (Content Creation)
> Files read: 11
> Total: 9 — Critical: 1, High: 4, Medium: 3, Low: 1

## 1. Two completely different visual languages inside the same tab group

- **Severity**: Critical
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/content/ui-hud/InventoryGridDesigner.tsx:141-205, src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:317-340 (vs.) src/components/modules/content/ui-hud/HudThemeEditor.tsx:541-585, src/components/modules/content/ui-hud/LowHealthPulse.tsx:114-156, src/components/modules/content/ui-hud/EnemyHealthBarFSM.tsx:85-100
- **Scenario**: Tabs `Menus` and `Inventory` render a maximalist "indigo cyberpunk" theme — radial blur orbs, dotted grid masks, glassmorphism, neon `drop-shadow`s, ALL_CAPS_SNAKE labels (`COMPILING_SYSTEM`, `INTERFACE_TOPOLOGY_AND_SCREEN_ROUTING`, `INITIALIZE_BUILD_SEQUENCE`). Tabs `HUD` and `Polish` render the project's neutral system: `SurfaceCard` chrome, sentence-case labels, status/accent tokens. Switching between adjacent tabs in the same module looks like swapping apps.
- **Root cause**: Inventory/MenuFlow were authored against a different visual brief and never assimilated into the SurfaceCard + chart-colors token system. Hex/rgba indigo values are inlined instead of pulled from `MODULE_COLORS.content`/`ACCENT_VIOLET`.
- **Impact**: Breaks the module-flow narrative — the FlowBar (UIHudView.tsx:54-85) implies one continuous workflow, but the visual identity hard-resets twice. Reduces user trust that they are still in the same product, and triples maintenance cost (three sets of CSS conventions to evolve).
- **Fix sketch**: Reskin both Inventory and MenuFlow onto `SurfaceCard level={1|2}`, replace the indigo palette with `MODULE_COLORS.content` (and `withOpacity` opacity tokens), and rewrite ALL_CAPS_SNAKE micro-copy as sentence case to match HudThemeEditor. Keep the glow accents but bound them inside one shared `<NodeCanvas>` wrapper so the surface intensity matches sibling cards.

## 2. Element color palette has three sources of truth

- **Severity**: High
- **Category**: Design System / Component Architecture
- **File**: src/components/modules/content/ui-hud/DamageNumberPalette.tsx:17-45, src/components/modules/content/ui-hud/DamageNumberPhysicsSimulator.tsx:24-30, src/components/modules/content/ui-hud/HudThemeEditor.tsx:52-58
- **Scenario**: `DamageNumberPalette` lists 23 elements with FLinearColor RGBA tuples; `DamageNumberPhysicsSimulator` redefines five (`physical`, `fire`, `ice`, `lightning`, `heal`) as CSS rgba strings; `HudThemeEditor` declares a third `DEFAULT_THEME.elementColors` map of the same five with the same numeric values. Crit even appears with subtly different hues (`Fire = (1.0, 0.3, 0.1)` in palette vs. `(255,77,26)` ≈ same but expressed differently in the simulator).
- **Root cause**: No shared `damage-elements.ts` constants module; each component was authored independently and re-typed the C++ defaults.
- **Impact**: When the C++ side updates (e.g. `Damage.Holy`), three files must change in lockstep. Visual drift is already visible — Palette swatches use FLinearColor floats, the Simulator hardcodes integer rgba, and HudThemeEditor uses a third format — so live preview colors won't match the palette swatch the user just clicked.
- **Fix sketch**: Extract `src/lib/hud/damage-elements.ts` exporting `DAMAGE_ELEMENTS: Record<DamageElement, { rgba: [number,number,number,number]; tag: string; category: ... }>` plus helpers `toCSS()` / `toHex()` / `lerp()` (currently duplicated 4×). Have all three components import from it and have `HudThemeEditor`'s defaults derive from it. This also eliminates the three local `toCSS`/`rgbaToCSS`/`toCSS` reimplementations.

## 3. Three slider components, three contracts

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/content/ui-hud/DamageNumberPhysicsSimulator.tsx:341-359 (`SliderParam`), src/components/modules/content/ui-hud/HudThemeEditor.tsx:232-255 (`SliderField` wrapping `StyledSlider`), src/components/modules/content/ui-hud/LowHealthPulse.tsx:202-212 (uses `StyledSlider` directly), src/components/modules/content/ui-hud/InventoryGridDesigner.tsx:635-670 (`DimensionControl` +/- buttons, no slider)
- **Scenario**: Four sibling components each adjust numeric parameters. Three of them render a horizontal slider, but one rolls a custom `<input type="range">` with inline `linear-gradient` background (`SliderParam`), one wraps `StyledSlider` with extra label formatting (`SliderField`), and one calls `StyledSlider` directly. The fourth (Inventory) skips sliders and uses chunky +/- buttons. Tracks, label widths, value formatting, and accent-color contracts all differ.
- **Root cause**: Each author solved "render a labeled slider" locally rather than reaching for or extending `StyledSlider`. `SliderParam` predates `StyledSlider`; `SliderField` is a thin re-wrapper that should be deleted.
- **Impact**: Three different drag interactions (track height, thumb hover, focus ring, displayValue formatting), three different visual heights, three different ways to pass an accent color. Users tweaking damage physics vs. fade timing get visibly different controls 6 inches apart.
- **Fix sketch**: Migrate `DamageNumberPhysicsSimulator.SliderParam` to call `StyledSlider`. Delete the local `SliderField` wrapper in HudThemeEditor; pass `displayValue` directly. Consider whether `DimensionControl` should also become a `<StyledSlider min={2} max={12} step={1}>` for consistency, or at minimum extract a shared `<SteppedNumberInput>`.

## 4. Hard-coded indigo color spectrum violates token discipline

- **Severity**: High
- **Category**: Design System / Magic Numbers
- **File**: src/components/modules/content/ui-hud/InventoryGridDesigner.tsx:141-160, 197-206, 471-501, 530-555 (and 30+ more sites), src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:318-389, 432-484, 525-555 (50+ sites)
- **Scenario**: Both files literally encode `rgba(99,102,241,...)`, `rgba(49,46,129,...)`, `rgba(52,211,153,...)`, `rgba(244,63,94,...)`, `rgba(165,180,252,...)`, `rgba(245,158,11,...)`, plus Tailwind classes `border-indigo-900/30`, `text-indigo-400/60`, `bg-emerald-500/20`, `text-rose-500`. Same six colors, different opacities, hand-written everywhere.
- **Root cause**: The components were styled by directly reaching into Tailwind's indigo/emerald/rose palette + raw rgba literals rather than going through the `chart-colors.ts` tokens (`ACCENT_VIOLET`, `STATUS_SUCCESS`, `STATUS_ERROR`, `withOpacity`) used by every other file in this scope.
- **Impact**: Theme-day pain — the project cannot reskin via tokens because hundreds of literal hexes are baked in. Opacity drift is rampant (`/30`, `/40`, `/50`, `/60` chosen by feel, not from `OPACITY_*` constants). Hover states blink because indigo-600 vs indigo-500 vs `rgba(99,102,241,...)` are not the same value.
- **Fix sketch**: Replace all literal indigo with `withOpacity(MODULE_COLORS.content, OPACITY_*)` (or `ACCENT_VIOLET`), all emerald with `STATUS_SUCCESS`, all rose with `STATUS_ERROR`. Replace Tailwind-class opacities with the canonical `OPACITY_10/15/20/25/30/40/50` tokens. A single sed pass plus visual diff would knock out ~80% mechanically.

## 5. FSM/MenuFlow/Pipeline reinvent flow-graph primitives independently

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/content/ui-hud/EnemyHealthBarFSM.tsx:101-225 (SVG nodes + arrow math), src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:275-651 (SVG nodes + arrow math + pan/drag), src/components/modules/content/models/AssetPipelineDiagram.tsx:118-251 (vertical chain + animated flow particles), src/components/modules/content/models/AssetInventory.tsx:65-148 (mini dependency graph)
- **Scenario**: Four separate diagram primitives render directed-edge graphs. EnemyHealthBarFSM has its own `getArrowPath`-equivalent inline math (`stateCenter`, parallel-edge offset, marker-end arrows). MenuFlowDiagram independently writes a separate `getArrowPath` (line 277-315) with arrowhead math, pan transform, and node-rectangle layout. AssetPipelineDiagram does a vertical timeline with framer-motion flow particles. AssetInventory's `DependencyGraph` is a third SVG layout pattern. None share types, hover semantics, edge-routing, or arrowhead defs.
- **Root cause**: No shared `<FlowGraph>` / `<DiagramNode>` / `<DiagramEdge>` primitive in `src/components/ui/`. Every author rewrote arrowhead trig (`ux = dx/len; ay1 = ty - uy*arrowSize + ux*arrowSize*0.5`) from scratch.
- **Impact**: Inconsistent arrowhead size (8 vs. 8 vs. unmarked), inconsistent edge offsets from node bounds (30/22 in FSM vs. 40 in MenuFlow vs. fixed in DependencyGraph), inconsistent node-corner radius (6 vs. 8 vs. 4). Bugs found in one (e.g., EnemyHealthBarFSM has hardcoded offset overrides for 4 specific transitions at lines 142-146 — a code smell for missing edge-routing) cannot be fixed centrally.
- **Fix sketch**: Extract `src/components/ui/FlowGraph/` with `<FlowGraphCanvas>` (handles pan, viewBox, defs/markers), `<FlowNode rect|rounded|circle>`, `<FlowEdge from to bidirectional kind="primary|secondary|reset">`. Migrate FSM and MenuFlow first (closest contracts); AssetPipeline can follow. Centralizes arrowhead trig, parallel-edge offsetting, hover/select states, and a11y (see #8).

## 6. AssetInventory mixes two scrollbar conventions and inline border radii

- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/content/models/AssetInventory.tsx:469-475, 500-510, 580
- **Scenario**: One render path uses `custom-scrollbar` (line 469), the expanded card uses `custom-scrollbar` again (line 580), but every other component in scope uses `global-scrollbar` (DamageNumberPalette.tsx:146, HudThemeEditor.tsx:667, MenuFlowDiagram.tsx:843, InventoryGridDesigner.tsx:225). Inline `borderRadius: '16px'` (line 504) collides with Tailwind `rounded-2xl` used by neighbours.
- **Root cause**: `AssetInventory` was built before `global-scrollbar` was standardized; `borderRadius: '16px'` is a leftover from an early refactor when the surface-card border-radius wasn't tokenized.
- **Impact**: Two scrollbar visuals in the same view; refactors of the global scrollbar style won't touch this one. Inline `16px` won't track theme changes to `--radius-2xl`.
- **Fix sketch**: Replace `custom-scrollbar` with `global-scrollbar` and `borderRadius: '16px'` with `rounded-2xl`. Audit for other inline radii (`rounded` numbers passed to SVG `<rect rx={...}>` are fine; CSS-side numbers should be tokenized).

## 7. Three Generate CTAs, three different button systems

- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/content/ui-hud/InventoryGridDesigner.tsx:570-595, src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:725-752, src/components/modules/content/ui-hud/HudThemeEditor.tsx:557-576 (export buttons), src/components/modules/content/models/AssetPipelineDiagram.tsx:227-240 (Execute AI Task)
- **Scenario**: Inventory and MenuFlow share a giant indigo "shimmer" CTA with sweeping gradient, indigo glow, ALL_CAPS_SNAKE labels (`INITIALIZE_BUILD_SEQUENCE`, `EXPORT_MENU_ARCHITECTURE`), `STATUS_STALE` text color (semantically wrong — STALE is a degraded/old indicator), and `disabled:opacity-50`. HudThemeEditor's actions are tiny icon buttons (`Copy`, `.h`). AssetPipelineDiagram's "Execute AI Task" is a flat indigo pill with `boxShadow: 0 0 15px ...`. Four different primary-action vocabularies in one feature area.
- **Root cause**: No `<PrimaryActionButton>` / `<GenerateCTA>` shared component. Each author shipped a one-off.
- **Impact**: Users learning that the giant shimmer button = "send to LLM" must re-learn at the HUD tab and again at the pipeline. The use of `STATUS_STALE` for active CTA color is a token misuse that will break under theme changes.
- **Fix sketch**: Add `<GenerateButton variant="primary|compact" loading icon>` to `src/components/ui/`. Pick one shimmer treatment (or drop the shimmer — it's distracting). Replace `STATUS_STALE` with `MODULE_COLORS.content` or a dedicated CTA token. Decide on sentence-case (`Generate inventory system`) vs. ALL_CAPS at the design-system level, not per-component.

## 8. Interactive SVG nodes are not keyboard-reachable

- **Severity**: Medium
- **Category**: Accessibility-as-polish
- **File**: src/components/modules/content/ui-hud/EnemyHealthBarFSM.tsx:185-223, src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:497-651
- **Scenario**: FSM `<g>` state nodes use `onClick` and `cursor-pointer` to toggle selection; MenuFlow `<g>` screens have `onMouseDown`/`onDoubleClick`/`onClick` for select/edit/connect. None expose `role="button"`, `tabIndex={0}`, `onKeyDown` for Space/Enter, `aria-label`, or `aria-pressed`. Drag-only interactions in MenuFlow are mouse-only.
- **Root cause**: SVG `<g>` doesn't get `cursor: pointer` semantics for free; authors stopped at the visual affordance.
- **Impact**: Keyboard users cannot select an FSM state to read its transitions; cannot reposition or connect MenuFlow nodes. Screen readers see unlabeled groups. This is the kind of thing that quietly fails an a11y audit.
- **Fix sketch**: Add `role="button" tabIndex={0} aria-label={state.label}` and an `onKeyDown` handler that mirrors the click for Space/Enter on each `<g>`. For MenuFlow, expose a keyboard alternative for connect/disconnect (e.g., select source with Enter, then Tab + Enter on target). Add `aria-pressed` for selection state. The shared `<FlowNode>` from #5 can bake this in.

## 9. SVG text font-size is a per-instance magic number

- **Severity**: Low
- **Category**: Magic Numbers / Design System
- **File**: src/components/modules/content/ui-hud/EnemyHealthBarFSM.tsx:170, 207, 215, src/components/modules/content/ui-hud/LowHealthPulse.tsx:303, 308, src/components/modules/content/ui-hud/MenuFlowDiagram.tsx:451, 593, 598, 610, src/components/modules/content/ui-hud/HudThemeEditor.tsx:643 (`fontSize={5}`)
- **Scenario**: Inline SVG text uses fontSize values 5, 6, 7, 8, 10, 11 with no rationale; `fontSize={5}` (HudThemeEditor fade timeline, LowHealthPulse axis labels) renders microscopic in normalized viewBoxes. Tailwind text classes can't be applied inside SVG, so values are typed by feel.
- **Root cause**: No SVG-text scale convention (e.g., `SVG_TEXT.xs/sm/md`) and no shared `<SvgLabel>` helper.
- **Impact**: Diagrams render labels at wildly different relative sizes between sibling components; fontSize=5 in a 116-unit viewBox is essentially unreadable except as decoration.
- **Fix sketch**: Define `const SVG_TEXT = { xs: 8, sm: 10, md: 11, lg: 13 }` in a shared diagram constants file and route all SVG text through it. Re-evaluate the `fontSize={5}` cases — they should likely be `SVG_TEXT.xs` (8) and the viewBox enlarged so the text remains legible.
