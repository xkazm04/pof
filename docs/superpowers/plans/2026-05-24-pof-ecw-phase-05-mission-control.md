# Phase 5 · Mission Control — Implementation Plan (focused scope)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Replace `MissionControlTabPlaceholder` with a functional Mission Control screen showing the project's at-a-glance state. **Focused scope** for Phase 5: catalog roll-up + activity feed + forecast placeholder. The full consolidation of the 5 existing dashboards (UnifiedSummary, ProjectHealth, AggregateQuality, DirectorOverview, CrossModule) lands incrementally in **Phase 10 enhancement work** — each is a substantial migration and they're all still reachable via the legacy shell at `/`.

**Architecture:** Read-only against existing stores. Reuses `useCatalogRoster` (Phase 3) for the 8-catalog roll-up and `useActivityFeedStore` (already in the app) for the activity feed. The Forecast panel is a placeholder card with a "(Phase 10)" note — it'll get the cook forecaster / NBA queue / playable-by ETA in subsequent enhancement work.

**Tech Stack:** React 19, Zustand v5 (existing stores), lucide-react.

---

## Files

### Create
- `src/components/ecw/mission/MissionControlTab.tsx` — top-level body for the Mission Control L1 tab.
- `src/components/ecw/mission/CatalogRollupCard.tsx` — overall lifecycle progress bar across all 8 catalogs.
- `src/components/ecw/mission/ActivityFeedCard.tsx` — most-recent N activity events.
- `src/components/ecw/mission/ForecastCard.tsx` — placeholder with Phase 10 anchors.
- Tests for each.

### Modify
- `src/components/ecw/NewAppShell.tsx` — swap `MissionControlTabPlaceholder` for `MissionControlTab`.
- `src/__tests__/components/ecw/NewAppShell.test.tsx` — adjust the tab-switch test to match new heading.

### Delete
- `src/components/ecw/tabs/MissionControlTabPlaceholder.tsx`.

---

## Task 1: `CatalogRollupCard`

Reads `useCatalogRoster` (Phase 3). Renders one big progress bar (total verified / total entities) + per-catalog mini bars. Failing badge if any catalog has failingCount > 0.

Commit: `feat(ecw-mission): CatalogRollupCard with 8-catalog roll-up (ECW Phase 5.1)`

## Task 2: `ActivityFeedCard`

Reads `useActivityFeedStore`. Shows the most recent 8 events with timestamp + title + type icon. "No activity yet" empty state.

Commit: `feat(ecw-mission): ActivityFeedCard reading from activityFeedStore (ECW Phase 5.2)`

## Task 3: `ForecastCard` (placeholder)

Static card with title "Forecast" + body listing what lands in Phase 10 (playable-by ETA · velocity · NBA queue · cook forecaster · what-if simulator). Marks the slot.

Commit: `feat(ecw-mission): ForecastCard placeholder for Phase 10 enhancements (ECW Phase 5.3)`

## Task 4: `MissionControlTab` composition

Header (h1 + subtitle) + 2-column grid: CatalogRollupCard | ForecastCard, full-width ActivityFeedCard below.

Commit: `feat(ecw-mission): MissionControlTab composition (ECW Phase 5.4)`

## Task 5: Wire into NewAppShell + delete placeholder

Replace `MissionControlTabPlaceholder` import. Update tab-switch test.

Commit: `feat(ecw-mission): wire MissionControlTab into NewAppShell (ECW Phase 5.5)`

## Task 6: Phase 5 verification + tag

Targeted vitest, tsc, eslint. Tag `ecw-phase-5-complete`.
