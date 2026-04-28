# UI Perfectionist — Wave 6 Fix Summary

> 6 commits, 6 findings closed (or partially closed).

Wave 6 of the scan-fix pipeline. Focus this wave was the data-state primitives the codebase had been skipping: empty states, loading skeletons, sonner adoption, and one tab-chrome polish fix. Built on waves 1–5 (chrome primitives, dashboard headers, section labels, tab factories, SVG helpers). Behavior parity was prioritized — every migration tried to preserve user-visible affordances while collapsing duplication.

## Per-commit table

| # | Hash    | Subject                                                                  | Files | Findings closed |
|---|---------|--------------------------------------------------------------------------|-------|-----------------|
| 1 | ce08408 | make Localization tab-count badges visually distinct                     | 1     | 19.2            |
| 2 | c81b01a | migrate ReviewableModuleView toast to sonner                             | 1     | 02.6            |
| 3 | a35d03d | add Suspense boundary + skeleton to ModuleRenderer                       | 1     | 30.1            |
| 4 | 67618b6 | adopt shared EmptyState in 5 game-director sites                         | 5     | 31.3            |
| 5 | f5ec44d | add empty-state short-circuits to chart panels                           | 3     | 04.5 (partial)  |
| 6 | 68f7515 | migrate Level Design custom toast to sonner                              | 1     | 13.3            |
| 7 | (this doc) | wave-6 fix summary                                                    | 1     | —               |

## What was fixed

### Fix 6 — Localization tab-count badges (finding 19.2)

`SubTab` in `LocalizationPipelineView.tsx` rendered the tab-count as plain `text-2xs text-text-muted` whether the tab was active or not, producing the "Strings" bright + "(412)" dim pull-apart called out in the report. Replaced the parenthesized count with a small rounded-full pill (bg-surface-2, tabular-nums) that swaps to an indigo-tinted pill on the active tab. The label and count now track active/inactive state together.

### Fix 5 — `ReviewableModuleView` sonner migration (finding 02.6)

The shared `ReviewableModuleView` had a bespoke absolutely-positioned toast (local state, manual `setTimeout(UI_TIMEOUTS.toast)` dismissal, inline `STATUS_SUCCESS`/`STATUS_ERROR` styling, no stacking, no a11y). Sync feedback and review-complete notifications now flow through sonner's global Toaster. Drops ~16 lines of ad-hoc styling and aligns with the rest of the app. Stale `STATUS_SUCCESS`/`STATUS_ERROR` imports removed.

### Fix 1 — `ModuleRenderer` Suspense + skeleton boundary (finding 30.1)

Wrapped each `<Component />` and `<SpecialComponent />` in `ModuleRenderer.tsx` in a shared `<Suspense fallback={<ModuleSkeleton />}>` inside the existing `ModuleErrorBoundary`. Establishes a consistent loading contract across every module — heavy R3F-backed views (Asset Viewer, Material Lab, Procedural Engine) no longer render a blank background while children suspend. The `ModuleSkeleton` mirrors typical module chrome (header bar with icon + 2 lines of placeholder text + a 6-tile grid) using the existing surface tokens. The crossfade veil is left intact for switch animations and is not relied on as the loading affordance anymore.

### Fix 2 — `<EmptyState>` adoption in game-director (finding 31.3)

Five (technically six, counting DirectorOverview's near-identical sibling) verbatim "rounded-2xl tinted icon tile with primary icon plus two satellite icons" empty states across the game-director module. Extended `<EmptyState>` with one new prop, `satelliteIcons={[bottomRight, topLeft]}`, and a tinted-CTA branch keyed on `iconColor`/`action.color`. The primitive's existing `iconColor` prop drives the bg/border via the existing `OPACITY_8`/`OPACITY_15` tokens — replacing the hand-tuned `${ACCENT}08`/`15`/`30` opacity literals each call site was inlining.

Migrated:

- `DirectorOverview.EmptyState` (was a local function with `Clapperboard` + no satellites — picked `Target` + `CheckCircle2` for visual parity with siblings)
- `SessionDetail.TimelineView` empty branch (Activity + Clock + Zap)
- `SessionDetail.CoverageView` empty branch (BarChart3 + Target + CheckCircle2)
- `FindingsExplorer` no-findings branch (Target + FileSearch + Search)
- `RegressionTrackerView` no-fingerprints branch (Bug + Shield + Eye)
- `RegressionTrackerView` no-alerts branch (AlertOctagon + Shield + CheckCircle2)

### Fix 3 — Empty-state short-circuits on chart panels (finding 04.5, partial)

Three of the four panels called out in finding 04.5 silently rendered degenerate output when arrays were empty or sparse:

- `PowerBudgetRadar` rendered NaN polygons at zero axes — now short-circuits to `<EmptyPanel>` when `radarAxes.length < 3`
- `XpCurveChart` assumed `data.length >= 2` — now short-circuits when `data.length < 2 || maxXp <= 0`
- `TimelineStrip` returned an empty `<div>` with no message — now returns `<EmptyPanel>` when `events.length === 0`

Introduced a small `<EmptyPanel label hint? height? />` primitive in `unique-tabs/_shared.tsx` (dashed border, surface-deep tint, `role="status"`). `SynergyDetector` was the only panel that already had a custom empty branch (the report notes this) and was left untouched to avoid behavior parity issues — its existing copy ("Add 2+ affixes...") is more contextually meaningful than the generic primitive would be.

### Fix 4 — Level Design sonner migration (finding 13.3)

Same shape as Fix 5, in `LevelDesignView.tsx`. Dropped the bespoke `rvToast` state, the manual `setTimeout(3000)` dismissal effect, and the absolutely-positioned JSX in favor of `toast.success` / `toast.error` calls. Four call sites (review import success/error, sync success/error) migrated. `STATUS_SUCCESS`/`STATUS_ERROR` imports retained — they're still used by the `SyncStatusPanel` color map at lines 845/848.

## Patterns established (catalogue items 30–32)

- **30. `<EmptyState satelliteIcons={[bottomRight, topLeft]} iconColor={accent} action={{label, onClick, icon, color}} />`** (`src/components/ui/EmptyState.tsx`) — extended with the satellite-icon "illustration block" composition (rounded-2xl tinted tile + primary 7×7 icon + 5×5 bottom-right + 4×4 top-left at 50%/30% opacity). When `satelliteIcons` is provided, the action CTA also switches to the tinted-pill variant the game-director module uses (driven by `iconColor`/`action.color`).
- **31. `<EmptyPanel label hint? height? />`** (`src/components/modules/core-engine/unique-tabs/_shared.tsx`) — lightweight in-card empty placeholder for chart/data panels, sized to fit inside a `SurfaceCard level=2` without disrupting surrounding grid. `role="status"` for a11y.
- **32. `<Suspense fallback={<ModuleSkeleton />}>` inside `ModuleErrorBoundary`** (`src/components/layout/ModuleRenderer.tsx`) — single shell-level loading contract. Every module gets identical chrome (header bar + 6-tile grid skeleton) when any descendant suspends.

## What remains (followups / skipped)

### Skipped or partial this wave

- **Fix 3 (finding 04.5) — partial.** Only 3 of the 4 cited panels needed remediation; `SynergyDetector` already had a contextually-better empty state. The report's broader fix sketch (`<PanelStateBoundary loading? empty? error? />`) was not pursued — the existing `LoadingSpinner` and the new `EmptyPanel` cover the discovered gaps without needing a wrapper indirection. If async telemetry from `useGenreEvolution` proves to need explicit loading skeletons later, the wrapper is the right shape.
- **The brief's alternative panel suggestions (DebugDashboard, ZoneMap, EnemyBestiary, AttributePointOptimizer)** were not swept. Finding 04.5 specifically lists 4 different files, and those were the right ones to target for behavior parity (degenerate visual output → safe placeholder). If those alternative panels surface their own empty-state regressions, they can adopt `<EmptyPanel>` cleanly.

### Followups (within the closed findings)

- **31.3 — `DirectorOverview.EmptyState`** local function still wraps the shared `<EmptyState>` in a `<motion.div>` for entrance animation. Could be promoted to a `motion={true}` prop on the shared primitive if other call sites also want fade-in. Not pursued: too speculative.
- **13.3 / 02.6 — sonner sweep.** Other modules may still have bespoke toasts. The pattern is now established and easy to replicate — a future "audit for `useState.*toast`" sweep could close them in one wave.
- **30.1 — module-specific skeletons.** The shared `<ModuleSkeleton>` is generic on purpose. Heavy R3F views (Asset Viewer, Material Lab) might still benefit from a tailored skeleton that matches their canvas chrome. Not pursued: visible benefit is small and cost-of-divergence is high.
- **19.2 — Hazards / String Tables tab-count consistency.** Only the top-level `SubTab` was migrated. The Hazards tab body's `<Badge variant="error">…critical</Badge>` chips have a different shape (severity pills, not tab counts) and were intentionally left alone.

`tsc --noEmit` was 0 before each commit and remains 0 after the wave.
