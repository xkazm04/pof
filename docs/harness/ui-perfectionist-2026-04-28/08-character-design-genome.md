# UI Perfectionist — Character Design & Genome

> Context: Character Design & Genome (Core Engine (aRPG))
> Files read: 19
> Total: 9 — Critical: 0, High: 4, Medium: 4, Low: 1

## 1. Two parallel "category-grouped collapsible parameter list" components drift apart

- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/PropertyInspector.tsx:76-184 ; src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/ParameterDetails.tsx:30-101
- **Scenario**: Both panels render the exact same conceptual UI: an icon + chevron + colored category header, an expand/collapse animation, and rows of `(label, NeonBar, value)` items keyed off a `category → fields` map. They were built independently, so they disagree on details that should be identical: PropertyInspector animates with `MOTION_CONFIG.standard` and `{ duration: 0.15 }`, while ParameterDetails uses `MOTION_CONFIG.spring` for the chevron and `MOTION_CONFIG.standard` for the wrapper. PropertyInspector closes-other-categories-on-search and shows a per-row "modified" pill; ParameterDetails defaults to a single `expandedCat` accordion with no multi-open. Row layouts are subtly different too (PropertyInspector: name-w28 / slider-w20 / value-min48 / pill-mlauto; ParameterDetails: name-w28 / NeonBar-flex1 / value-w14).
- **Root cause**: No shared `<CategoryAccordion>` / `<ParamRow>` primitive. Each surface re-implements the icon-chevron-header + `AnimatePresence` height-collapse + row block.
- **Impact**: Two near-identical patterns that diverge over time. Visual inconsistency between Blueprint Overview and AI-Feel Optimizer, doubled bug surface (e.g. only one supports search collapse-bypass), and no shared keyboard interaction (neither participates in `aria-expanded`/`button[aria-controls]` semantics).
- **Fix sketch**: Extract `<ParamCategoryGroup color icon label count expanded onToggle>{children}</ParamCategoryGroup>` plus `<ParamRow label color value valueWidth bar slot=after />` to `unique-tabs/_design.tsx` (peer of `BlueprintPanel`). Both files consume them, with PropertyInspector passing a slider to the `bar` slot and ParameterDetails passing a NeonBar. Standardize on `MOTION_CONFIG.standard` + `MOTION_CONFIG.micro` for chevron rotate. Add `aria-expanded`/`aria-controls` once at the primitive layer.

## 2. Hard-coded character hex colours bypass the design-system token registry

- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/data.ts:366-428
- **Scenario**: The 50+ entry `CHAR_DEFS` array routinely mixes token references (`ACCENT_CYAN`, `STATUS_ERROR`) with raw hex literals (`'#3b82f6'`, `'#818cf8'`, `'#6d28d9'`, `'#93c5fd'`, `'#78716c'`, `'#ea580c'`, `'#f59e0b'`, `'#d97706'`, `'#b45309'`, `'#7c3aed'`, `'#e879f9'`, `'#d946ef'`, `'#f0abfc'`, `'#16a34a'`, `'#059669'`, `'#075985'`, `'#0284c7'`, `'#0891b2'`, `'#67e8f9'`, `'#0ea5e9'`, `'#ec4899'`, `'#db2777'`, `'#f9a8d4'`, `'#fb7185'`, `'#fda4af'`, `'#dc2626'`, `'#b91c1c'`, `'#991b1b'`, `'#fca5a5'`, `'#e11d48'`, `'#9ca3af'`, `'#4b5563'`, `'#d1d5db'`, `'#374151'`). These flow straight into `withOpacity(...)` calls, NeonBar fills, comparison crowns, radar overlays, and the picker dot in `index.tsx`.
- **Root cause**: When the comment "design system" block in `chart-colors` ran out of named slots for tier/family variants, authors dropped to Tailwind v3 hex codes inline rather than extending the token export.
- **Impact**: The character palette can no longer be re-themed (light mode, contrast pass, brand swap) by editing `chart-colors.ts`. Any colour audit will miss them. Glow/opacity stacks composed via `withOpacity(token, ...)` look subtly different from the same recipe applied to a hex literal because authors forget to use `withOpacity` on raw strings.
- **Fix sketch**: Promote a tier-scaled palette into `chart-colors.ts` — e.g. `CHAR_BLUE_500/300/700`, `CHAR_VIOLET_*`, `CHAR_RED_*`, `CHAR_GRAY_*` — covering the lights/darks the array reaches for. Replace every hex in `CHAR_DEFS` with a token. Add an ESLint rule (`no-restricted-syntax` for hex literals in `data.ts`) or a Vitest snapshot guard so future entries cannot regress.

## 3. PropertyInspector slider max is computed from the row's own value, so the thumb never reaches the right edge

- **Severity**: High
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/PropertyInspector.tsx:135-144
- **Scenario**: The slider declares `max={Math.max(Number(prop.defaultVal) * 3, Number(prop.current) * 1.5)}`. As the user drags toward the right, the max grows with `current`, so the visual fill ratio never crosses ~66% — pulling the thumb to the visible right end raises the max and pulls the thumb back. Conversely, `min={0}` means a property like `GravityScale` (default 1.0) has its meaningful range (0.5–2.0) compressed into the bottom 33% of the track.
- **Root cause**: Per-property `min/max` were not threaded through from `BLUEPRINT_PROPERTIES` (which stores only `current`/`defaultVal`). The author improvised a heuristic instead of extending the data shape.
- **Impact**: Sliders feel "stuck" and unresponsive — the thumb never reaches max, granularity is wrong for fractional properties (step=0.05 over a 0–3 range gives 60 stops for what should be 30), and visually-identical Movement/Combat/Camera rows have wildly different effective ranges. This is the kind of micro-sluggishness a player-facing tool cannot ship with.
- **Fix sketch**: Add `min`, `max`, `step`, and `unit` to `BlueprintProperty` in `data.ts:474` (mirroring `FieldDef` in `CharacterGenomeEditor/types.ts`). Bind the slider directly to those values. Persist `unit` to render alongside the value. As a follow-up, factor a `<ParamSlider>` shared with `ParameterDetails` so the same range model drives both.

## 4. CharacterScalingPreview is missing a marker on the NeonBar showing where the current level sits

- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/CharacterScalingPreview.tsx:38-79
- **Scenario**: Each property card shows current value (animated number), a NeonBar filled `pct = ((val - min) / (max - min)) * 100`, and min/max labels underneath. Because the bar always fills `pct` from the left edge, the user reads "the bar grew" but loses the reference frame — at level 25 the bar is 50% full, at level 50 it is 100% full, with no tick or pip showing where intermediate breakpoints sit, and the level slider above it is visually disconnected from the four cards below.
- **Root cause**: NeonBar is rendered as a single fill with no overlay slot for ticks or a current-position diamond.
- **Impact**: The page reads as four redundant fill animations rather than a precise scaling visualization. Users cannot eyeball "is MeshScale linear with level?" — which is exactly the question this widget exists to answer.
- **Fix sketch**: Add an absolutely-positioned tick row above the NeonBar showing levels 1/13/25/38/50, and a glowing diamond/pip at `left: pct%` that animates with the slider. Optionally render dual bars (default vs. current) so non-linear scaling stands out. Bonus: change min/max footer labels to `{prop.min}{unit} → {prop.max}{unit}` with a current-value-overlay arrow.

## 5. Comparison rows in ComparisonRow.tsx render two stacked bars in one track that obscure each other

- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/ComparisonRow.tsx:35-48
- **Scenario**: A/B comparison renders both A and B values into the same `flex-1 h-3` container as overlapping `absolute` divs — A is `opacity-60` solid fill, B is `opacity-30` semi-transparent fill with a `border-r-2`. When A > B the B-fill is fully eclipsed by A, so the user only sees one bar. When B > A, the right edge of A is masked by B's translucent fill and reads as muddy.
- **Root cause**: The visual idiom of "two values on one track" was implemented as two siblings without a stagger, indent, or split-track layout.
- **Impact**: The ComparisonPanel's primary visual — A vs. B side-by-side — is unreadable for half its rows. Users compensate by reading only the numeric values on the sides, defeating the bar's purpose.
- **Fix sketch**: Split the track into two stacked bars within the same flex container (top half = A, bottom half = B), each height ~5px with a 1px gap, sharing the same baseline track. Or render side-by-side from the centre using `flex-row-reverse` for A and `flex-row` for B, with values radiating outward. Either way, neither bar should occlude the other. Cross-reference: `ComparisonMatrix.tsx:120` already uses a single `NeonBar` per cell — that idiom (one row per character, not stacked) is more legible and could be reused.

## 6. CameraProfileComparison ViewportMockup uses a fixed 180×120 viewBox, so the FOV cone clips when 3 viewports squeeze into `grid-cols-3`

- **Severity**: Medium
- **Category**: responsive
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/CameraProfileComparison.tsx:25-83, 161
- **Scenario**: Each ViewportMockup renders `width="100%"` SVG with `viewBox="0 0 180 120"`. When `selected.size === 6` the parent applies `grid-cols-3`, so each mockup is ~33% of the panel width. Inside the SVG, FOV cone path uses absolute coordinates `M ${90 - armLen},20 L ${90 - fovAngle * 0.8},110` where `fovAngle` reaches up to 90 — meaning the path extends to `x = 90 - 72 = 18` and `x = 90 + 72 = 162`, and at narrow column widths the bottom-row labels at `x={4}` collide with the cone, while the bottom-right "FOV/Arm/Lag" line wraps via `<text>` (no wrap) and overflows.
- **Root cause**: SVG content was authored at one size with no responsive consideration for the 3-up grid case, and the bottom info line is a single `<text>` element (no wrapping in SVG without `<foreignObject>` or manual splitting).
- **Impact**: At sub-280px column widths, the camera position label overlaps the FOV cone wedge and the FOV/Arm/Lag readout truncates. The "compare 4–6 profiles" interaction is the panel's headline feature, so this hits exactly the most-used path.
- **Fix sketch**: Either (a) drop `grid-cols-3` to `grid-cols-2` past 4 selected profiles and let the parent grid wrap, or (b) split the bottom info line into three `<text>` elements positioned at x=4/x=60/x=130 with smaller font, or (c) move the readout out of the SVG into an HTML row beneath each mockup, so it can flex/wrap. Add a `min-width` constraint on the mockup container (`min-w-[200px]`).

## 7. PresetCard hover scale clips inside the parent grid cell because parent does not define `overflow-visible`

- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/PresetCard.tsx:25-36
- **Scenario**: PresetCard has `whileHover={{ scale: 1.02 }}` and the card itself has `overflow-hidden` on its outer `motion.div` (because of `CornerBrackets` positioning). The card's own border + shadow remains inside, but the parent grid that lays these cards out has no `overflow-visible`, so hover-glow box-shadows on adjacent cards get cropped at cell boundaries when cards are tightly packed. More importantly, the `overflow-hidden` on the card itself clips the very corner-bracket motif `<CornerBrackets />` is meant to render at the corners.
- **Root cause**: A single `overflow-hidden` was added (probably to contain the gradient/glow background) but it conflicts with `CornerBrackets`, which positions absolute marks at offset `-1` to sit on the border.
- **Impact**: The "blueprint corner bracket" identity that this whole tab leans on is invisible on these cards. Hover glow looks rectangular rather than spilling.
- **Fix sketch**: Remove `overflow-hidden` from the outer card; if a gradient bg needs clipping, wrap only the gradient layer in an inner `overflow-hidden absolute inset-0 -z-10`. Verify CornerBrackets reach the visible corners. Add `overflow-visible` to the parent grid that hosts these cards in `CharacterFeelOptimizer/index.tsx`.

## 8. NarrativeBreadcrumb in CharacterBlueprint uses inline `style={{ fontWeight, opacity }}` instead of state classes — diverges from the SubTabNavigation pattern below it

- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/CharacterBlueprint/index.tsx:57-84
- **Scenario**: Two navigation rows sit stacked: the custom NarrativeBreadcrumb (`Catalog > Define > Control > …`) and the shared `SubTabNavigation`. The breadcrumb mixes Tailwind classes with inline `style` for colour/font-weight/opacity per state (active/past/future), while SubTabNavigation drives the same three states via class variants. Visual artefacts: the past-step colour is `withOpacity(ACCENT, '99')` (60%) while SubTabNavigation past-step is full ACCENT — so a step that's "past" looks dimmer in the breadcrumb than in the tab strip directly underneath. Active fontWeight is 700 in breadcrumb vs. SubTabNavigation's bold class which renders 600 in this fontstack.
- **Root cause**: Two navigation surfaces for the same `activeTab` state were authored independently rather than the breadcrumb being a slim adapter over the tab list.
- **Impact**: The doubled navigation reads as inconsistent — stepping through tabs makes the breadcrumb's "past" state lighter than the tabs' "past" state, which is the exact opposite cue users expect (visited links should not get fainter than the active row right below them).
- **Fix sketch**: Either delete NarrativeBreadcrumb (the SubTabNavigation already does this job with icons) or refactor it into a `<TabBreadcrumb tabs={NARRATIVE_STEPS} active={activeTab} />` primitive that internally reuses the same tokens/classes as `SubTabNavigation`. Drop the `withOpacity('99')` past colour — past state should match the tab strip's past colour exactly.

## 9. Many tabular layouts in this context use `w-12`, `w-14`, `w-20`, `w-28` width prescriptions that do not survive narrow viewports

- **Severity**: Low
- **Category**: responsive
- **File**: src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/ComparisonRow.tsx:28-58 ; src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/ParameterDetails.tsx:77-83 ; src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/PropertyInspector.tsx:126-143
- **Scenario**: Param-row layouts use fixed pixel widths via Tailwind classes (`w-28` label, `w-12`/`w-14` value, `w-20` slider) inside containers with no horizontal scroll. On narrow side-panel widths (e.g. when the AI-Feel Optimizer is rendered next to a wider sidebar in the future, or on a 1280px laptop with a side rail open), the sum of those widths plus gaps exceeds container width and the values overflow.
- **Root cause**: Fixed pixel buckets with no `flex-shrink-0` on every consumer + no `min-w-0` on the flex parent — the pattern works at the dev viewport but is fragile.
- **Impact**: At narrow widths, value columns get truncated by `overflow: hidden` on the panel, occasionally hiding the right-hand value entirely. Not catastrophic but cumulative across the surface.
- **Fix sketch**: When extracting the shared `<ParamRow>` primitive in finding 1, build it with a `grid-cols-[7rem_minmax(0,1fr)_4rem_5rem]` grid instead of a flex of fixed widths — that way the bar column is the flex column and the value column has a guaranteed footprint without overflow. Add `min-w-0` on the bar cell so it shrinks before the labels do.
