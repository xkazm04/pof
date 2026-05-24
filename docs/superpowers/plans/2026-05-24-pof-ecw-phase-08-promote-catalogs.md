# Phase 8 · Promote 1 of 3 modules (Materials substrate) as catalog proof

> REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Prove the catalog substrate accepts a 9th catalog (`materials`) without modification — types added, seed registered, hub shows the new row at 0/0. Audio + animation-assets follow the same template in Phase 8b once we're ready to lift their real data from existing modules.

**Architecture:** Pure additive. New `MaterialCatalogEntry` type. New `seed-materials.ts` returning `[]`. Register in `sections.ts`. Optional: a stub recipe (no testPath yet — production recipe comes when we wire real material asset generation).

## Files
- Modify: `src/lib/catalog/types.ts` (add `MaterialCatalogEntry`)
- Create: `src/lib/catalog/seed-materials.ts` (returns `[]`)
- Modify: `src/lib/catalog/sections.ts` (register)
- Tests verifying the catalog appears + has 0 entities

## Task 1: types + seed + sections + tests
- [ ] Add `MaterialCatalogEntry { catalogId: 'materials'; data: { displayName: string; baseColor?: string } }` to types.ts
- [ ] `seedMaterialEntries(): MaterialCatalogEntry[] => []`
- [ ] Register `{ catalogId: 'materials', label: 'Materials', seed: seedMaterialEntries }` in CATALOG_SECTIONS
- [ ] Vitest: assert CATALOG_SECTIONS now has 9 entries including materials
- [ ] Vitest: `useCatalogRoster()` returns a 9th row with label='Materials', total=0

Commit: `feat(catalog): materials catalog substrate (Phase 8 — substrate proof)`
