# UI Perfectionist — Wave 4 Fix Summary

> 6 commits, 5 findings closed.

Wave 4 of the scan-fix pipeline. Built on the design-system foundation laid by waves 1–3 (KPICard, AccentButton, TintedButton, StatusDot, ChipButton, CopyButton, ScoreRing). Focus this wave was page / section / dashboard chrome consolidation — extracting shared header primitives and migrating forks.

## Per-commit table

| # | Hash      | Subject                                                                | Files | Findings closed |
|---|-----------|------------------------------------------------------------------------|-------|-----------------|
| 1 | 6719868   | extract DashboardHeader primitive                                      | 7     | 20.2            |
| 2 | 13d10ca   | migrate dzin variant-A section headers to SectionLabel                 | 8     | 09.1            |
| 3 | 644d0e6   | extract TabHeader for visual-gen tab bodies                            | 4     | 24.1            |
| 4 | b9a1896   | extract createTabbedModuleView, rewrite DialogueView                   | 2     | 16.1            |
| 5 | 78bb03a   | extract shared moduleTopology for DependencyGraph + NexusView          | 3     | 20.5            |
| 6 | (this doc)| wave-4 fix summary                                                     | 1     | —               |

## What was fixed

### Fix 1 — `DashboardHeader` primitive (finding 20.2)

The 5+ evaluator dashboards each hand-rolled a "icon-tile + title + subtitle + action button" page header — three different conventions sitting one tab-switch apart (gradient tile vs. soft tile vs. bare-icon). Extracted `<DashboardHeader>` to `src/components/ui/`. Migrated 6 call sites: AssetScout, PerformanceProfiling, PatternLibrary, CombatSimulator, EconomySimulator, HolisticHealth. Three used the gradient-tile variant (`variant="gradient"`, default), three used the soft-tile variant (`variant="soft"`, e.g. HolisticHealth's `bg-emerald-500/10` recipe). API supports `accent`/`accentTo` for the gradient color pair, `size` for h1 vs h2 type scale, and `action` + `secondaryAction` slots so the existing button styling can pass through unchanged. Tailwind-JIT-safe via static accent-class lookup tables.

### Fix 2 — `SectionLabel` extension (finding 09.1)

Half the dzin panels hand-rolled their `text-xs font-bold uppercase ... flex items-center gap-2` section header inline, the other half used the imported `SectionLabel` helper — divergent type sizes (`text-xs` vs. `text-sm`) and icon sizes (`w-4 h-4` vs. `w-3 h-3`) sat side-by-side on the same density. Extended `SectionLabel` with `iconClassName` (escape hatch for `text-{color}-400` Tailwind tints), `className` (so callers can pass `DZIN_SPACING.full.sectionMb`), and `size: 'xs' | 'sm'` (xs matches the variant-A rhythm). Migrated 8 call sites across 7 panels: AbilitiesPanel ×2, AttributesPanel, CharacterInputPanel, CharacterOverviewPanel, CharacterMovementPanel, CorePanel, TagsPanel.

### Fix 3 — `TabHeader` for visual-gen tab bodies (finding 24.1)

Six visual-gen tab bodies inlined identical `<div className="text-center"><h2>…</h2><p>…</p></div>` blocks. Created `<TabHeader>` in `src/components/modules/shared/` — distinct from `DashboardHeader` because tab-body sub-section headers are intentionally minimal (no icon tile, no action slot). Migrated AssetForge, AssetBrowser, plus all 4 BlenderPipeline tabs (Pipeline, LOD, MeshOpt, FBX). Did not reuse DashboardHeader — different API shape (centered, icon-less) would have required `variant="bare-tab"` discrimination that bloats the more general primitive.

### Fix 4 — `createTabbedModuleView` factory + DialogueView rewrite (finding 16.1)

DialogueView was a 500-line outlier vs. its 4 three-line `createSimpleModuleView` siblings (InputView, PhysicsView, SaveLoadView, MultiplayerView). It hand-rolled a `generator | checklist` tab switcher with inline `style={{ borderColor: ACCENT }}` underline drift and fully duplicated `<ReviewableModuleView>` prop wiring. Discovered that `ReviewableModuleView` already supported an `extraTabs` prop — so the fix was to add the missing `createTabbedModuleView(moduleId, tabs)` companion factory next to `createSimpleModuleView` and have DialogueView defer to it. The bespoke tab block, the `ACCENT` constant's tab-styling role, and the duplicated prop set are all gone; DialogueView's exported declaration is now a single `createTabbedModuleView('dialogue-quests', [{ id: 'generator', ... }])` call. The 400+ lines of `QuestGeneratorPanel` (and its sub-components) stay co-located in DialogueView.tsx because they are panel-specific.

### Fix 5 — Shared `moduleTopology` for DependencyGraph + NexusView (finding 20.5)

`DependencyGraph` and `NexusView` each maintained an identical `MODULE_POSITIONS` table (4 cols × 3 rows of arpg-* modules), an identical `getNodeCenter` helper, and ad-hoc layout constants (DependencyGraph: `COL_WIDTH=180 / NODE_W=140`; NexusView: `200/160`). Extracted `_shared/moduleTopology.ts` exporting `MODULE_POSITIONS`, two layout presets (`TOPOLOGY_COMPACT`, `TOPOLOGY_ROOMY`), and a `getNodeCenter(moduleId, layout)` factory. Chose option (b) from the brief — a layout-math hook rather than a `<TopologyGraph>` component — because the JSX shape is structurally divergent: DependencyGraph renders flat rects, NexusView renders pseudo-3D nodes with multiple layer overlays. Adding a new ARPG module (e.g. `arpg-cinematics`) now requires touching one file instead of three.

## Patterns established (catalogue items 21–25)

- **21. `<DashboardHeader>`** (`src/components/ui/DashboardHeader.tsx`) — page-level header for module dashboards. Icon tile (gradient or soft), title + subtitle, optional action and secondaryAction slots. Standard accent palette (10 Tailwind colors) via static class lookup tables (JIT-safe).
- **22. Extended `SectionLabel`** (`src/components/modules/core-engine/unique-tabs/_shared.tsx`) — adds `iconClassName`, `className`, and `size: 'xs' | 'sm'` props for migrating legacy variant-A dzin panel section headers without losing their `text-{color}-400` icon tints or `DZIN_SPACING.full.sectionMb` rhythm.
- **23. `<TabHeader>`** (`src/components/modules/shared/TabHeader.tsx`) — minimal centered/left-aligned title + description for `ReviewableModuleView` extra-tab bodies. Intentionally distinct from `DashboardHeader` (no icon tile, no action slot).
- **24. `createTabbedModuleView(moduleId, tabs)`** (`src/components/modules/shared/createTabbedModuleView.tsx`) — factory companion to `createSimpleModuleView`. Threads caller-supplied panels through `ReviewableModuleView`'s existing `extraTabs` prop. Future modules that need a custom panel alongside the standard checklist surface should reach for this instead of hand-rolling their own tab bar.
- **25. Shared `moduleTopology`** (`src/components/modules/evaluator/_shared/moduleTopology.ts`) — `MODULE_POSITIONS`, `TopologyLayout` interface, `TOPOLOGY_COMPACT` / `TOPOLOGY_ROOMY` presets, `getNodeCenter`. Single source of truth for the ARPG module grid layout used by topology views.

## What remains (followups)

- **20.1 KPICard migration** — the 12 local `StatCard`/`MetricCard` reimplementations are partially-migrated already (most call sites in fixes 1's targets now use `KPICard` indirectly through their existing imports), but `AggregateQualityDashboard.tsx`, `CrossModuleOverlapPanel.tsx`, `WeeklyDigestView.tsx`, `SessionAnalyticsDashboard.tsx`, `PostProcessStudioView.tsx` still ship private `MetricCard` components. Out of scope this wave (no new chrome primitive needed; just call-site migration).
- **20.2 remaining dashboard headers** — `AggregateQualityDashboard`, `ProjectHealthDashboard`, `GameDesignDocView`, `NexusView`, `DeepEvalResults` do not currently have top-level page headers (they open with control bars or radial gauges instead). If those views grow a header in the future, they should use `<DashboardHeader>`. `LocalizationPipelineView` and `CrashAnalyzerView` still ship the soft-tile variant inline — followup.
- **09.1 dzin variant-A non-icon headers** — 12+ remaining `<div className="text-xs font-bold uppercase text-text-muted mb-2">{label}</div>` blocks without icons (Eval{Deps,Insights,Quality,Roadmap,PatternLibrary} "Summary" headers, ItemDNA "Genome Presets / Operations", LootAffix "Rolling Tiers by Rarity", InventoryCatalog "Rarity Tiers", LoadoutPanel "Optimal/Alternative Loadouts", ItemEconomy "Economy Alerts", TagAuditPanel "Blocked By"/"Lifecycle"/"Tag Usage Frequency"). These could migrate to `<SectionLabel size="xs" />` (no icon prop) but the brief's call-site cap was 8.
- **24.2 / 24.3 visual-gen primary-button & form-card dedupe** — finding 24.3 (six-way drift on the visual-gen primary CTA) and 24.2 (3× form-card duplication in BlenderPipeline tabs) were not addressed this wave. Out of scope per brief — TabHeader was the explicit goal.
- **09.2 / 09.6 StatusDot inline-recipe migration & DzinSection wrapper** — separate findings, not in wave-4 scope.
- **20.5 CrossModuleOverlapPanel `ModuleBubble`** — finding 20.5 mentions a third site (`OverlapPanel`'s `ModuleBubble`) that hard-codes `rgba(248, 113, 113, ...)`. Not migrated this wave; could become a `<ModuleNode variant="bubble">` in a follow-up if a JSX-shape primitive is later extracted.

`tsc --noEmit` was 0 before each commit and remains 0 after the wave.
