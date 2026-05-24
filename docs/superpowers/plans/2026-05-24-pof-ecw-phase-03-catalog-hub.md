# Phase 3 · Catalog Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace `CatalogsTabPlaceholder` with a working **Catalog Hub** — a root overview listing the 8 catalogs (progress bar, entry count, verified count), and a per-catalog detail view (entity tree on the left, EntityInspector on the right). Selection routes through `useEcwStore.selectEntity`. This is where the Phase 2 inspector primitive becomes usable.

**Architecture:** Read-only against `CATALOG_SECTIONS` + `useCatalogStore`. No mutations. Tree groups entities by `categoryPath` (single-level for now — depth-2 grouping lands in Phase 7 with per-catalog tree definitions). Selecting an entity calls `useEcwStore.selectEntity(catalogId, entityId)`. Mounting catalog id (without entity) shows the catalog detail; mounting at the hub root with no catalogId shows the 8-row overview.

**Tech Stack:** React 19, Zustand v5, lucide-react. Reuses `useCatalogEntities`, `CATALOG_SECTIONS`, the Phase 2 `EntityInspector`. No new infra.

---

## Files

### Create
- `src/components/ecw/catalogs/CatalogsTab.tsx` — top-level switcher: root if no catalogId selected, detail if one is.
- `src/components/ecw/catalogs/CatalogHubRoot.tsx` — 8-row overview with progress bars + counts.
- `src/components/ecw/catalogs/CatalogDetailView.tsx` — tree + inspector layout.
- `src/components/ecw/catalogs/EntityTree.tsx` — categoryPath-grouped entity list with counts.
- `src/components/ecw/catalogs/CatalogRow.tsx` — one row in the hub overview.
- `src/components/ecw/catalogs/useCatalogRoster.ts` — hook computing per-catalog stats.
- Tests under `src/__tests__/components/ecw/catalogs/`.

### Modify
- `src/components/ecw/NewAppShell.tsx` — replace `CatalogsTabPlaceholder` import with `CatalogsTab`.

### Delete
- `src/components/ecw/tabs/CatalogsTabPlaceholder.tsx` — replaced by real component.

---

## Task 1: `useCatalogRoster` — aggregate per-catalog stats

Returns: `Array<{ catalogId: string; label: string; total: number; verified: number; lastTestVerdict?: 'pass'|'fail'; failingCount: number }>`. Reads from `useCatalogStore` + `CATALOG_SECTIONS`.

Tests:
- Returns 8 entries with the correct catalogIds from CATALOG_SECTIONS
- Computes `total` from store entries
- Computes `verified` as count where `lifecycle === 'verified'`
- Computes `failingCount` as count where `lastTestResult === 'fail'`

Commit: `feat(ecw-catalogs): useCatalogRoster hook (ECW Phase 3.1)`

## Task 2: `CatalogRow`

One row: catalog label · progress bar (verified/total) · "N entries · M verified" · failing badge if any. Click → calls a passed-in `onSelect(catalogId)`.

Tests:
- Renders label and counts
- Progress bar width reflects verified/total ratio
- Failing badge appears when failingCount > 0
- Click invokes onSelect

Commit: `feat(ecw-catalogs): CatalogRow with progress + counts (ECW Phase 3.2)`

## Task 3: `CatalogHubRoot`

Renders 8 `CatalogRow`s using the roster hook. Click → `useEcwStore.selectEntity(catalogId, null)` (catalog selected, no entity yet).

Tests:
- Renders one row per CATALOG_SECTIONS entry
- Clicking a row selects the catalog via ecwStore

Commit: `feat(ecw-catalogs): CatalogHubRoot 8-row overview (ECW Phase 3.3)`

## Task 4: `EntityTree`

Left-pane tree grouping entities by `categoryPath[0]` (depth-1 grouping for Phase 3; deeper hierarchies in Phase 7).

Tests:
- Groups entities by first category path segment
- Selected entity has visual selected state (aria-current)
- Click → `selectEntity(catalogId, entityId)`

Commit: `feat(ecw-catalogs): EntityTree categoryPath-grouped list (ECW Phase 3.4)`

## Task 5: `CatalogDetailView`

Layout: header (catalog label + "back to hub" button) · 2-column body (EntityTree left, EntityInspector right).

Tests:
- "back to hub" clears activeCatalogId via selectEntity(null,null)
- EntityInspector renders the selected entity (or EmptyInspector if none)

Commit: `feat(ecw-catalogs): CatalogDetailView tree+inspector layout (ECW Phase 3.5)`

## Task 6: `CatalogsTab` switcher

Routes: catalogId null → CatalogHubRoot; catalogId set → CatalogDetailView.

Commit: `feat(ecw-catalogs): CatalogsTab root/detail switcher (ECW Phase 3.6)`

## Task 7: Wire into NewAppShell + delete placeholder

Replace `CatalogsTabPlaceholder` import; remove the placeholder file.

Tests: Update `NewAppShell.test.tsx` — catalogs tab now renders Catalog Hub root heading instead of placeholder text. The 4-test suite stays at 5 tests but adapts.

Commit: `feat(ecw-catalogs): wire CatalogsTab into NewAppShell, drop placeholder (ECW Phase 3.7)`

## Task 8: Phase 3 verification + tag

- Targeted vitest sweep
- tsc clean on touched files
- eslint clean
- Tag `ecw-phase-3-complete`
