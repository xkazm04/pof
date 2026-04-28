# UI Perfectionist — Core Engine Panels & Views

> Context: Core Engine Panels & Views (Core Engine (aRPG))
> Files read: 16
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Section header chrome forked into two divergent variants across 10 panels
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/dzin-panels/CorePanel.tsx:142-144, AbilitiesPanel.tsx:127-128, AttributesPanel.tsx:159-161, TagsPanel.tsx:156-158 (variant A); AttributesPanel.tsx:214,222, DamageCalcPanel.tsx:139, EffectsPanel.tsx:140,159, EffectTimelinePanel.tsx:94, LoadoutPanel.tsx:91, TagDepsPanel.tsx:131,195, TagAuditPanel.tsx:268 (variant B / `SectionLabel`)
- **Scenario**: Every full-density `SurfaceCard` opens with a section header that names the section and pairs an icon. Roughly half the panels (Core, Abilities, Attributes catalog, Tags) hand-roll this as `<div class="text-xs font-bold uppercase text-text-muted ... flex items-center gap-2"><Icon className="w-4 h-4 text-..." /> Label</div>`. The other half use the imported `SectionLabel` helper. The two variants render slightly differently — hand-rolled variants apply panel-specific text colors to the icon (text-blue-400, text-purple-400, text-emerald-400, text-amber-400) while `SectionLabel` accepts a `color` prop with hex values; spacing classes also vary (`DZIN_SPACING.full.sectionMb` vs implicit margin from `SectionLabel`).
- **Root cause**: `SectionLabel` was introduced but never enforced; older panels were not migrated. There is no lint rule or shared header subcomponent gating the chrome.
- **Impact**: Visual drift between sibling panels at the same density (e.g., user toggles from Effects to Effect Types card — same `SurfaceCard level={2}` but the header label reads with different baseline spacing and a colored vs. muted icon). Future refactors of one variant silently leave the other behind.
- **Fix sketch**: Make `SectionLabel` the single approved API; add an `iconClassName`/tailwind-color escape hatch so the four panels currently using `text-blue-400`/`text-purple-400`/`text-emerald-400`/`text-amber-400` icon tints can migrate without losing intent. Codemod the four offenders. Then add an ESLint `no-restricted-syntax` rule banning the literal `text-xs font-bold uppercase text-text-muted` flex+icon pattern outside `SectionLabel`.

## 2. "Status dot" pill is reimplemented inline in 8+ places with three competing sizes/glow recipes
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/dzin-panels/CorePanel.tsx:79-83, 101, 151; AbilitiesPanel.tsx:142-145; AttributesPanel.tsx:109-112, 126, 180, 204; EffectsPanel.tsx:84-87, 103-106, 146-148; TagsPanel.tsx:106-110, 124-128, 171-175, 193-196; TagDepsPanel.tsx:200-202; LoadoutPanel.tsx:71-74; DamageCalcPanel.tsx (no instance — but Compact uses identical pattern at 121-124)
- **Scenario**: Every panel renders status/category dots as a small colored circle, but no two implementations agree. Sizes vary (`w-2 h-2`, `w-2.5 h-2.5`, `w-3 h-3`, `w-1.5 h-1.5`). Glow varies ("none", `boxShadow: 0 0 0 3px ${color}33`, `boxShadow: 0 0 4px ${color}60`, `boxShadow: 0 0 6px ${color}60`, `boxShadow: 0 0 0 3px rgba(96,165,250,0.2)`). All hand-roll the inline style block, repeating `flex-shrink-0 rounded-full` Tailwind.
- **Root cause**: No shared `<StatusDot size="sm|md" color={c} glow="ring|halo|none" />` primitive. Each panel author chose a recipe ad hoc.
- **Impact**: At full density, side-by-side panels (Effects' `w-2.5 h-2.5` halo dot next to Tags' `w-3 h-3` ring dot) render visibly mismatched bullets at identical hierarchy levels — looks like a designer error, not intent. Hover/contrast tuning is impossible centrally.
- **Fix sketch**: Add `src/components/ui/StatusDot.tsx` with `size: 'xs' | 'sm' | 'md'` (mapping to 1.5/2/3 px) and `emphasis: 'none' | 'ring' | 'halo'` (no glow / `0 0 0 3px ${c}33` / `0 0 6px ${c}60`). Codemod replace all 25+ inline call sites. Document allowed combinations in the dzin design tokens doc.

## 3. Compact-density wrapper has 3+ ad-hoc deviations from `DZIN_SPACING.compact.wrapper`
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/dzin-panels/EffectTimelinePanel.tsx:61 (raw `p-2`), TagAuditPanel.tsx:155 (uses spacing token correctly but adds `text-xs` collision); EffectsPanel.tsx:69 + nested wrappers at 71, 97 (token + manual `space-y-1` + manual `border-t pl-...`); TagsPanel.tsx:104-105 (token + `mb-1.5` adds extra spacing); AttributesPanel.tsx:107-108 (token + interleaved `w-full` bars that break the standard list rhythm)
- **Scenario**: `DZIN_SPACING.compact.wrapper` should establish a uniform "compact list" rhythm so a user sweeping eyes across 10 stacked compact panels gets a consistent baseline grid. In practice TimelineCompact replaces the wrapper with a one-off `p-2` container, EffectsCompact nests three different list groups with different spacing, and AttributesCompact mixes progress bars between text rows so the row height changes mid-list.
- **Root cause**: `DZIN_SPACING.compact.wrapper` likely encodes only `space-y-*` + padding, but compact-density usage expects per-row line-height parity that the token does not enforce. Authors fall back to inline tweaks.
- **Impact**: Stacked compact panels produce a jagged "every panel is its own height rhythm" board view — particularly visible in the fly-out where 6 compact panels are siblings.
- **Fix sketch**: Extend the spacing tokens to expose `compact.row` (line-height + min-height for one row) and `compact.subgroup` (space between subgroups). Refactor TimelineCompact to use the wrapper. Refactor AttributesCompact to render its progress bars via a `<CompactStatRow label count bar />` primitive matching the row height of dot-only rows. Audit all 10 compact functions for raw `p-*` / `space-y-*` overrides.

## 4. Accent colors specified as raw hex strings inline instead of imported tokens
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/dzin-panels/AbilitiesPanel.tsx:122 (`accent="#a855f7"`), AttributesPanel.tsx:153, 154 (`accent="#10b981"`), 214, 222 (`color="#10b981"`); TagsPanel.tsx:152 (`accent="#f59e0b"`); LoadoutPanel.tsx:91, 136 (`color="#a855f7"` / `accent="#a855f7"`); DamageCalcPanel.tsx:139 (`color="#f97316"`); TagAuditPanel.tsx:268 (`color="#fbbf24"`)
- **Scenario**: The codebase exports semantic tokens like `ACCENT_PURPLE_BOLD` (used for purple), `ACCENT_EMERALD_DARK`, `STATUS_WARNING`, `MODULE_COLORS.core`. Yet `FeatureCard accent` and `SectionLabel color` props are passed literal hex strings. Worse, `#a855f7` already exists as `ACCENT_PURPLE_BOLD` — and `ACCENT_PURPLE_BOLD` is even imported in the same file in some cases (LoadoutPanel.tsx:6) yet still bypassed for the prop.
- **Root cause**: When `FeatureCard`/`SectionLabel` were introduced, accent props accepted raw color strings and authors copy-pasted hex from design refs. No type narrowing or token enforcement.
- **Impact**: Dark/light theme refactors and brand re-skins must hunt down dozens of inlined hex codes. `#10b981` differs from `MODULE_COLORS.attributes` if the latter ever shifts, silently desyncing the panel from the rest of the module's chart layer.
- **Fix sketch**: Replace each hex literal with the matching token (`ACCENT_PURPLE_BOLD` for `#a855f7`, `ACCENT_EMERALD_DARK` for `#10b981`, `STATUS_WARNING`/`#f59e0b`, `ACCENT_ORANGE`/`#f97316`, `#fbbf24` → add `STATUS_WARNING_BRIGHT` if needed). Tighten the prop type to a string union over known token values, or accept a `keyof typeof TOKENS`. Add an ESLint `no-restricted-syntax` for hex literals in `dzin-panels/*`.

## 5. Two SVG diagrams ship without empty / loading / error states and `<title>`/aria-labels
- **Severity**: Medium
- **Category**: accessibility-polish
- **File**: src/components/modules/core-engine/dzin-panels/AttributesPanel.tsx:285-368 (AttributeRelationshipWeb) + 386-425 (AttributeGrowthChart); TagDepsPanel.tsx:133-190; DamageCalcPanel.tsx:42-100
- **Scenario**: All four hand-built SVGs — relationship web, growth chart, GAS pipeline, tag-dep graph — render directly with no `role="img"`, no `<title>`, no `aria-label`, no fallback when `nodes.length === 0` or `points` is empty (the chart silently passes `Math.max(...[])` → `-Infinity`). They also have no skeleton/loading state; the panels assume the constants are always populated.
- **Root cause**: SVGs were authored with hard-coded demo data, so empty/loading paths weren't considered. Accessibility was not part of the panel's polish checklist.
- **Impact**: Once these panels are wired to live data (`featureMap`-driven node sets), an empty list will render `NaN` coordinates and broken charts. Screen readers announce nothing for any of the diagrams — a regression vs. the textual `Compact` density.
- **Fix sketch**: Each SVG should accept `data` props (already partially shaped), guard with `if (!data.length) return <EmptyChart label="No attribute relationships defined" />`, and wrap with `<svg role="img" aria-labelledby="…-title"><title id="…-title">Attribute Relationship Web — 9 nodes, 5 edges</title>…`. Add a `<ChartSkeleton />` shimmer for the still-loading featureMap case in the parent.

## 6. `SurfaceCard level={2}` "card with section header" pattern repeats 18+ times verbatim
- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/dzin-panels/CorePanel.tsx:141-156, 159-164; AbilitiesPanel.tsx:126-150, 153-188; AttributesPanel.tsx:158-210, 213-218, 221-226; DamageCalcPanel.tsx:138-143; EffectsPanel.tsx:139-155, 158-163; EffectTimelinePanel.tsx:93-102; LoadoutPanel.tsx:90-162; TagDepsPanel.tsx:130-191, 194-207; TagAuditPanel.tsx:267-371; TagsPanel.tsx:155-206
- **Scenario**: The exact pattern `<SurfaceCard level={2} className="${DZIN_SPACING.full.card} relative overflow-hidden"><SectionLabel … />…children…</SurfaceCard>` appears in every full-density panel, often twice or three times. Each call repeats `relative overflow-hidden` and the spacing token. There is no `<Section title icon color>` wrapper.
- **Root cause**: `PanelFrame` exists for the outer chrome but no analogous `Section` exists for inner section cards. Authors duplicate the boilerplate.
- **Impact**: Cosmetic adjustments (e.g., adding a hairline divider under all section labels, or changing the card's hover glow) require editing 18+ sites. Drift between the two SectionLabel variants (issue 1) is amplified.
- **Fix sketch**: Add `<DzinSection title icon color level={2|3} className?>{children}</DzinSection>` that internally renders `SurfaceCard + SectionLabel + content wrapper with DZIN_SPACING.full.contentMt`. Migrate panels in waves, keeping the typed `level` prop so future hierarchy changes (level 2 → 3 within a parent) become a one-prop edit.

## 7. Mixed font-size scale: `text-2xs`, `text-[10px]`, `text-[11px]`, `text-xs` used interchangeably for the same hierarchy
- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/dzin-panels/EffectTimelinePanel.tsx:48-49, 80; AbilitiesPanel.tsx:141; EffectsPanel.tsx:90, 151; TagsPanel.tsx:179, 191; AttributesPanel.tsx:163, 187, 314, 363, 365, 394, 400, 416 (all `text-[11px]`); TagDepsPanel.tsx:157, 181 (`text-[11px]`); DamageCalcPanel.tsx:61, 71 (`text-[11px]`); TagAuditPanel.tsx:243 (`text-[10px]`)
- **Scenario**: For the same role (chart axis labels, legend labels, fine-print captions) the codebase uses `text-2xs` (a Tailwind extension) in some panels, `text-[11px]` in SVG-heavy panels, and `text-[10px]` in TagAuditPanel's score-ring legend. Within AttributesPanel.tsx, both `text-2xs` (line 163) and `text-[11px]` (line 187) appear within the same SurfaceCard for label-level text.
- **Root cause**: SVG `<text>` elements can't use Tailwind `text-2xs` reliably (depending on Tailwind 4 config), so authors fell back to arbitrary `text-[11px]`. But this exception leaked into HTML elements adjacent to SVGs and into ScoreRingLegend.
- **Impact**: A user comparing legends across panels sees different label sizes (10px, 11px, 12px) for the same hierarchy level. Hard to spot individually, but creates a sloppy gestalt across the 10-panel board view.
- **Fix sketch**: Define `--text-xxs: 10px`, `--text-2xs: 11px` (rename current `text-2xs` if it's 12px), and `--text-xs: 12px` as CSS variables. Provide a Tailwind utility that resolves to those vars usable inside SVG via `font-size: var(--text-xxs)`. Codemod all `text-[10px]` → `text-xxs`, `text-[11px]` → `text-2xs` (or unified equivalent). Removes ~15 magic-number font sizes.

## 8. PlanView's tab bar is a one-off implementation that diverges from project tab patterns
- **Severity**: Low
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/PlanView.tsx:35-83
- **Scenario**: PlanView hand-rolls a horizontal tab bar (Plan / Evolution) with a `TabButton` private component, manual underline animation via absolute span, and Tailwind hover states. Meanwhile `GenreModuleView` uses `ReviewableModuleView` with `extraTabs` — a tab-rendering primitive that already exists and is used everywhere else in the module. PlanView re-implements similar chrome at a different scale.
- **Root cause**: PlanView was added later as a "dedicated view" (per its docblock) and chose a bespoke tab UI rather than threading through `ReviewableModuleView` or extracting the tab bar.
- **Impact**: PlanView's underline indicator does not animate (no Framer `layoutId` shared transition); other tab bars in the project do. Hover states use simple color swap, not the elevation/halo seen on dzin selectable surfaces. Diverges from the project's tab idiom.
- **Fix sketch**: Extract the tab bar into `<DzinTabs tabs={[{id, label, icon}]} active onChange accent />` and use it in both PlanView and `ReviewableModuleView`'s extra-tabs renderer. Use Framer `layoutId` for the underline so switching tabs shares a smooth transition. Match the hover idiom from `PanelFrame`'s selectable header.
