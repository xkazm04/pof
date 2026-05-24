# Phase 2 · Entity Inspector Primitive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the universal `EntityInspector` shell that all 8 catalogs (plus the 3 promoted in Phase 8) will plug into. It renders any `StoredCatalogEntity` with five generic panels: Header · Spec · Lifecycle + UE Assets · Cross-links · Functional Test. A `Facets` tab strip slot is created but empty — per-catalog custom facets (`ArchetypesTab` migrating in, `ComboChainDiagram` migrating in, etc.) land in Phase 7.

**Architecture:** Pure presentational. Reads a `StoredCatalogEntity` prop. Reads recipe metadata via `getRecipe(entity.catalogId)` for the testPath. Dispatches navigation through `useEcwStore.selectEntity(catalogId, entityId)` when a cross-link is clicked. No store mutations of its own — display + nav only. Phase 3 wires it into the Catalog Hub; Phase 4 wires the (Re)generate button to the CLI Rail.

**Tech Stack:** React 19, existing `LifecycleBadge`, lucide-react, focus-ring tokens. Reuses `getRecipe` from `@/lib/catalog/recipe`.

---

## File Structure

### Create

- `src/components/ecw/inspector/EntityInspector.tsx` — composition root, accepts `entity: StoredCatalogEntity | null`.
- `src/components/ecw/inspector/EntityHeader.tsx` — name, categoryPath breadcrumb, lifecycle badge, (Re)generate stub button.
- `src/components/ecw/inspector/EntitySpecPanel.tsx` — collapsible JSON view of `entity.data`. Per-catalog rich editors come later.
- `src/components/ecw/inspector/EntityLifecyclePanel.tsx` — current lifecycle, UE asset paths (copy/open buttons), last-test verdict.
- `src/components/ecw/inspector/EntityCrossLinksPanel.tsx` — renders `entity.links` as click-through buttons → `useEcwStore.selectEntity`.
- `src/components/ecw/inspector/EntityFunctionalTestPanel.tsx` — recipe `testPath` + last test verdict + last verifiedAt.
- `src/components/ecw/inspector/EntityFacetsTabStrip.tsx` — empty placeholder for per-catalog custom facets (Phase 7 fills).
- `src/components/ecw/inspector/EmptyInspector.tsx` — "no entity selected" state.
- Tests for each in `src/__tests__/components/ecw/inspector/`.

### Do NOT touch

- `src/lib/catalog/**` — catalog substrate is read-only.
- Existing `CatalogLifecycleCell` — Phase 3 wires it in alongside this; Phase 2 just builds the inspector.

---

## Task 1: `EmptyInspector` placeholder

- [ ] **Step 1**: Test + impl + commit.

`src/components/ecw/inspector/EmptyInspector.tsx`:
```tsx
'use client';
import { Box } from 'lucide-react';

export function EmptyInspector() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-2 p-8">
      <Box className="w-8 h-8 opacity-50" />
      <p className="text-sm">Select an entity from a catalog to inspect.</p>
    </div>
  );
}
```

Test: rendered text + icon present.

Commit: `feat(ecw-inspector): EmptyInspector empty state (ECW Phase 2.1)`

---

## Task 2: `EntityHeader` — name + breadcrumb + lifecycle badge

`EntityHeader.tsx` receives `{ entity }`. Renders: categoryPath joined by `▸`, then entity name as `<h2>`, then a `LifecycleBadge` (reused from `@/components/catalog/LifecycleBadge`).

Test: renders name, breadcrumb segments, lifecycle badge for a sample `BestiaryEntry`.

Commit: `feat(ecw-inspector): EntityHeader with breadcrumb + lifecycle badge (ECW Phase 2.2)`

---

## Task 3: `EntitySpecPanel` — JSON-rendered design data

Collapsible panel rendering `entity.data` as a pretty-printed `<pre>`. Per-catalog rich editors are out of scope here — they migrate in Phase 7. Title: "Spec". Default collapsed=false. Toggle via local state.

Test: opens collapsed by default? No — open by default. Toggles when title clicked. Renders a known key from sample data.

Commit: `feat(ecw-inspector): EntitySpecPanel JSON view of entity.data (ECW Phase 2.3)`

---

## Task 4: `EntityLifecyclePanel` — lifecycle + UE assets

Renders:
- Current lifecycle text + badge
- UE assets list with copy-to-clipboard button per row (no clipboard plumbing in tests; use `aria-label="copy <path>"` and assert the button exists)
- Last test verdict + lastVerifiedAt

If `entity.ueAssets` is empty/undefined, show "No UE assets generated yet."

Test: shows asset paths when present, "No UE assets" when empty.

Commit: `feat(ecw-inspector): EntityLifecyclePanel with UE assets + test history (ECW Phase 2.4)`

---

## Task 5: `EntityCrossLinksPanel` — click-through to linked entities

For each `link` in `entity.links`, render a row: `[role]  catalogId ▸ entityId`. Click → `useEcwStore.selectEntity(link.catalogId, link.entityId)`.

If `entity.links` is empty/undefined, show "No cross-catalog links."

Test: renders a link row for a sample entity with `links=[{catalogId:'spellbook',entityId:'ga-fireball',role:'ability'}]`. Clicking the row updates the store.

Commit: `feat(ecw-inspector): EntityCrossLinksPanel with click-through navigation (ECW Phase 2.5)`

---

## Task 6: `EntityFunctionalTestPanel` — recipe testPath + last verdict

Reads `getRecipe(entity.catalogId)` for `testPath`. Renders:
- The testPath string (mono font)
- Last test verdict badge (pass green / fail red / no-run gray)
- lastVerifiedAt as relative time

Disabled "Run again" button (wired to CLI Rail in Phase 4).

Test: renders the recipe testPath for a bestiary entity.

Commit: `feat(ecw-inspector): EntityFunctionalTestPanel reads recipe.testPath (ECW Phase 2.6)`

---

## Task 7: `EntityFacetsTabStrip` — empty placeholder

Single empty `<div role="tabpanel">` with text "Per-catalog custom facets land in Phase 7." Future: a registry maps catalogId → array of facet definitions that this strip renders.

No test (trivial); covered by EntityInspector composition test in Task 8.

Commit: `feat(ecw-inspector): EntityFacetsTabStrip placeholder for Phase 7 (ECW Phase 2.7)`

---

## Task 8: `EntityInspector` — composition

Composes all 6 panels. Renders `EmptyInspector` if `entity == null`.

Test: with sample entity, all 5 panels render (header + spec + lifecycle + crosslinks + functional test + facets strip). With null, only EmptyInspector renders.

Commit: `feat(ecw-inspector): EntityInspector composition over the 6 facet panels (ECW Phase 2.8)`

---

## Task 9: Phase 2 verification sweep + tag

- Targeted vitest: `npx vitest run src/__tests__/components/ecw/inspector`
- tsc on inspector files
- eslint on inspector files
- Milestone commit + tag `ecw-phase-2-complete`

---

## Self-review notes

- Spec coverage §3.2 (Entity Inspector): all 6 facet panels covered. Per-catalog custom facets (the lower "Facets" tab strip from the spec) are placeholder — Phase 7 fills.
- Type consistency: `StoredCatalogEntity` (the catalog-substrate type) is the only prop entry point. Subtypes (`BestiaryEntry` etc.) flow through `data: unknown`.
- Wiring discipline: no mutations except `useEcwStore.selectEntity` from CrossLinks. No CLI dispatch yet — that's Phase 4.
