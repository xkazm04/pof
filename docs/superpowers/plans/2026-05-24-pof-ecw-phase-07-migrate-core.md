# Phase 7 · Module migration A · Foundation + Bestiary proof

> REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Land the **facet registry pattern** that lets existing module UIs (ArchetypesTab, ComboChainDiagram, FlowNodesTab, ZoneMap inner sections, AnimationStateGraph panels) mount as per-catalog facets inside the EntityInspector's EntityFacetsTabStrip slot. Migrate the Bestiary `ArchetypesTab` as the proof point. The other 4 Core Engine modules get their own Phase 7b plans once the registry pattern is proven.

**Architecture:** A `facetRegistry` keyed by catalogId returns an array of `{ id, label, Component }`. `EntityFacetsTabStrip` reads the registry for the active entity's catalogId and renders a tab strip of registered facets. Each facet component receives the `StoredCatalogEntity` as a prop. Bestiary registers one facet that wraps the existing ArchetypesTab data flow into an entity-scoped view.

## Files

### Create
- `src/components/ecw/inspector/facetRegistry.ts` — registry + types.
- `src/components/ecw/facets/bestiary/BestiaryDetailFacet.tsx` — renders the archetype detail for one bestiary entity (Phase 7 proof scope: header + abilities list + threat bar; full ArchetypesTab migration happens in P7b).
- Tests for both.

### Modify
- `src/components/ecw/inspector/EntityFacetsTabStrip.tsx` — read facets from registry, render tab strip.

## Task 1: `facetRegistry`

```ts
export interface FacetDef {
  id: string;
  label: string;
  Component: React.ComponentType<{ entity: StoredCatalogEntity }>;
}
export function registerFacet(catalogId: string, def: FacetDef): void
export function getFacetsForCatalog(catalogId: string): FacetDef[]
```

Tests: register + retrieve + unknown catalog returns [].

Commit: `feat(ecw-facets): facetRegistry for per-catalog custom facets (ECW Phase 7.1)`

## Task 2: `BestiaryDetailFacet`

Phase 7 scope: header (name + role/tier) + abilities list (from `entity.data.abilities`) + threat-level bar. Self-registers via module side-effect import.

Commit: `feat(ecw-facets): BestiaryDetailFacet — Phase 7 proof migration (ECW Phase 7.2)`

## Task 3: Wire registry into EntityFacetsTabStrip

Read `getFacetsForCatalog(entity.catalogId)`, render tabs + active facet body. Empty state "No custom facets registered" for catalogs without facets (the 7 others until P7b).

Commit: `feat(ecw-facets): wire facetRegistry into EntityFacetsTabStrip (ECW Phase 7.3)`

## Task 4: Phase 7 verification + tag `ecw-phase-7-complete`
