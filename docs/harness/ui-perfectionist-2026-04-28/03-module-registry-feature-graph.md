# UI Perfectionist — Module Registry & Feature Graph (instance 1)

> Context: Module Registry & Feature Graph (Module System & Navigation)
> Files read: 17
> Total: 7 — Critical: 0, High: 3, Medium: 3, Low: 1

## 1. `knowledgeTips` data slot exists registry-wide but only one shape consumes it
- **Severity**: High
- **Category**: component-architecture
- **File**: src/lib/module-registry.ts:432-554 (and ~12 more empty arrays); consumed only at src/components/modules/ModuleShell.tsx:122-142
- **Scenario**: Every `SubModuleDefinition` carries a `knowledgeTips: KnowledgeTip[]` field. About half the modules ship populated tips (best-practice + feasibility), the other half are `knowledgeTips: []`. The `ReviewableModuleView` (which the registry-driven `createSimpleModuleView` factory wraps) never renders tips at all — only the legacy `ModuleShell` does, and only the single `feasibility`-source tip behind a "moderate feasibility" gate.
- **Root cause**: There is no shared "Knowledge Tips" panel/component, so registry data routinely declared by authors is silently dropped on the modern (`ReviewableModuleView`) surface that the registry factory uses.
- **Impact**: Authors waste effort filling in `knowledgeTips`; users on `arpg-*` modules (all empty arrays) see nothing while `visual-gen` modules' tips render only via legacy shell — a real visual inconsistency between sibling modules of the same project.
- **Fix sketch**: Extract a `KnowledgeTipList` shared component that takes `KnowledgeTip[]` plus an optional `source` filter; render it from `ReviewableModuleView` (e.g., as an info strip beneath the header or inside the Quick Actions panel). Either backfill `knowledgeTips` for every module or move the field to optional and remove empty stubs so the registry's intent is honest.

## 2. Two incompatible module shells coexist with divergent registry-driven UI
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/shared/ReviewableModuleView.tsx:291-442 vs src/components/modules/ModuleShell.tsx:107-246
- **Scenario**: The registry feeds two completely different page layouts. `ReviewableModuleView` has tabbed Overview/Roadmap, slide-over Quick Actions, `RecommendedNextBanner`, `ContextHealthBadge`, and toast/state machinery. `ModuleShell` is a single scrolling page with inline Quick Actions cards, Ask-Claude input, art-gap banner, ContextPreview, and history list. Same registry entries can render either way depending on which factory is used, with totally different visual hierarchy, header treatment, and accent placement.
- **Root cause**: `createSimpleModuleView` only constructs `ReviewableModuleView`, while `ModuleShell` continues to be wired in elsewhere. There's no contract that says "registry → one canonical UI shape."
- **Impact**: User-perceived inconsistency between modules of the same product (different headers, different action UIs, different banners) and double maintenance — a registry-level field change has to be threaded through both shells or it diverges.
- **Fix sketch**: Pick one shell as canonical, fold the missing pieces (Ask Claude input, ModuleHeaderDecoration, history) into it, and delete the other. If both surfaces must coexist short-term, derive both from a shared `<ModuleHeader>` + `<ModuleQuickActions>` so registry data has exactly one rendering path per slot.

## 3. `RecommendedNextBanner` collapses three distinct registry signals into one cramped strip
- **Severity**: High
- **Category**: visual-consistency
- **File**: src/components/modules/shared/RecommendedNextBanner.tsx:124-175
- **Scenario**: This banner conditionally renders unmet prerequisites (warning style) and recommended-next modules (neutral style) stacked with `space-y-2`. The two cards use opposing color languages — amber pill grid vs. accent-color compass — but the same vertical real estate, the same `mb-4` gutter, and the prereq pills inline a CSS-only tooltip absolutely-positioned `-top-8` that will clip against the banner's own border on the first row.
- **Root cause**: The banner mixes two semantically different states (blocked vs. ready) into one banner without a unified visual rhythm or shared progress treatment, and the tooltip is `pointer-events-none` but rendered inside the same overflow context.
- **Impact**: Users see two near-banners back-to-back with conflicting cues and a tooltip that gets clipped on the first row's pill. Visual hierarchy reads as "two warnings" rather than "one block, one path forward."
- **Fix sketch**: Either collapse to a single banner with an internal divider and consistent typographic scale, or split prerequisites and recommendations into discrete components on different rows of the page (prereq is a header-adjacent warning; "Recommended Next" is a footer rail). Move the tooltip to a portal or use `<Tooltip>` primitive to escape clipping. Promote the amber pill into a shared `<ProgressPill>` so the prereq arc and any recommendation completion arc share the same atom.

## 4. `MiniProgressArc` and `ContextHealthBadge` dot encode the same idea with hand-rolled inline geometry
- **Severity**: Medium
- **Category**: design-system
- **File**: src/components/modules/shared/RecommendedNextBanner.tsx:29-66; src/components/modules/shared/ContextHealthBadge.tsx:137-155, 175-197, 289-303
- **Scenario**: Both components draw tiny status indicators with raw `<svg>` / `<span>` math, hard-coded sizes (16, 6, 5), inline `style={{ width: 6, height: 6, ... }}`, hard-coded amber shades (`text-amber-500/25`, `text-amber-400`) instead of tokens, and hand-built pulse-ring keyframes via Framer Motion. `ScanRow` then re-implements the dot a third time inside the same file.
- **Root cause**: No `<StatusDot>` / `<StatusArc>` primitive exists in the shared module library, so each consumer redefines size, color, and glow on the spot.
- **Impact**: Drift in dot diameters (4px vs 5px vs 6px), inconsistent color sourcing (Tailwind classes in one place, `STATUS_SUCCESS` constants in another, `var(--text-muted)` literal in a third), and visual mismatch between the same "OK/warn/error" idea across three call-sites.
- **Fix sketch**: Add `<StatusDot size sm|md, tone success|warn|info|muted, pulse?>` and `<MiniProgressArc value tone>` to `components/modules/shared/`. Replace the three local implementations and centralize tone→`MODULE_COLORS`/`statusGlow` mapping. Drop magic numbers in favor of tokenized sizes (e.g., `--dot-sm: 5px`).

## 5. Tab system treats all registry-driven content as full-height except Overview/Roadmap, leaking layout math
- **Severity**: Medium
- **Category**: responsive
- **File**: src/components/modules/shared/ReviewableModuleView.tsx:361-363
- **Scenario**: Extra tabs (registry/feature-graph driven) wrap their render in `<div ... style={{ minHeight: 'calc(100vh - 180px)' }}>`, but the Overview and Roadmap tabs do not. The 180px is an undocumented offset that assumes a header + tab bar height that other code is free to change.
- **Root cause**: A magic-number layout constant smuggled inline. There's no shared `<TabPanel>` component that owns sizing, so every extra tab inherits a fragile assumption about chrome height.
- **Impact**: When the prerequisite banner renders, the page becomes taller than the viewport on extra tabs but exactly fits on Overview — same module, different scrollbar behavior depending on tab. On smaller laptops the calc underflows and content gets a hidden second scrollbar.
- **Fix sketch**: Replace the inline style with a flex-based `<TabPanel>` that owns `flex-1 min-h-0` semantics, or compute the chrome offset from a CSS var (`--module-chrome: …`) set by the header. Either way, all three tab branches in this component should share the same sizing primitive.

## 6. Toast and Quick-Actions toggle hard-code z-index ordering and use absolute/fixed inconsistently
- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/shared/ReviewableModuleView.tsx:367-391, 423-439
- **Scenario**: The Quick Actions edge tab is `absolute right-0 top-3` with `Z_INDEX.overlay`, the slide-over panel is `fixed top-0 right-0` with `Z_INDEX.panel`, the backdrop is `fixed inset-0` with `Z_INDEX.backdrop`, and the toast is `absolute bottom-4 right-4` with `Z_INDEX.toast`. Mixing `absolute` and `fixed` for sibling overlays in the same module shell means scrolling behavior diverges (toast scrolls with content, panel doesn't) and the edge-tab "fixed on right edge" comment in code is wrong — it's `absolute`.
- **Root cause**: Each overlay was added in isolation without a shared portal/positioning convention.
- **Impact**: On long roadmaps, the toast and edge tab slide off-screen with content while the slide-over panel stays put; users miss confirmations. Z-index registry exists but positioning is mismatched.
- **Fix sketch**: Decide per-overlay: panel + backdrop + edge tab + toast all `fixed` to module viewport (or all `absolute` and clamp the scroll container). Document the rule in the Z_INDEX file ("toast and overlays are always fixed to viewport"). Pull the edge-tab and toast into shared components used elsewhere.

## 7. `getChecklistSizes()` rebuilds a registry-wide dictionary on every banner mount
- **Severity**: Low
- **Category**: polish
- **File**: src/components/modules/shared/RecommendedNextBanner.tsx:16-22, 105
- **Scenario**: `getChecklistSizes` walks every entry of `SUB_MODULE_MAP` to produce a dictionary, called inside `useMemo(() => getChecklistSizes(), [])` per `RecommendedNextBanner` instance — meaning each module page that mounts the banner allocates its own copy of a global derived value.
- **Root cause**: A registry-wide derived map is computed at component scope instead of module scope. Same pattern would also mask future registry changes (HMR-only) since the memo has no deps.
- **Impact**: Minor — wasted allocation per page mount and a missed opportunity to expose a memoized `CHECKLIST_SIZES` from `module-registry.ts` next to `MODULE_LABELS`.
- **Fix sketch**: Export a top-level `CHECKLIST_SIZES: Record<SubModuleId, number>` from `module-registry.ts` (computed once at module load, like `MODULE_LABELS`) and import it directly. Drop the `useMemo` and helper.
