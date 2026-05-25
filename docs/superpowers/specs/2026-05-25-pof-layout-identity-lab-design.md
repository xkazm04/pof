# UI Identity Lab (`/layout`) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (directions).

## Why

The catalog/pipeline taxonomy is the keeper; the app's **UI identity and composition surface are unbuilt** — there's no usable view for a person to browse/compose catalog data. Before any redesign, prototype distinct visual identities of the core **catalog-row-selection** screen and pick a direction. This lab is throwaway-grade exploration, isolated from the app's production shell.

## What

A new route **`/layout`** with a **tab switcher** across **5 fully self-styled identity variants**, each rendering the *same* content + data — the catalog hub: the 30 catalogs grouped by spreadsheet category, each with label, description, and counts (total / verified). Only the identity changes between tabs.

Variants are **independent of the app's Dzin theme** (own palette via inline styles + own web fonts via `next/font`), so each is a true alternative identity, not a reskin of the current tokens.

## The 5 variants (design DNA)

1. **Atelier** — editorial / light. Paper `#faf7f2`, ink `#1a1714`, accent oxblood `#7c2d12`; **Fraunces** serif display + Inter body; hairline rules, small-caps eyebrow labels, generous whitespace, no card fills (rules + space do the work). Premium, calm, content-first.
2. **Forge** — thematic / dark. Obsidian `#16130f`, ember accent `#f59e42`/`#e2502a`; **Oswald** condensed industrial display + Inter body + IBM Plex Mono stats; tactile cards with a faint top-bevel highlight + bold per-category color chips. Energetic, on-theme for an RPG-asset tool.
3. **Blueprint** — technical drafting / light. Pale blue-gray ground `#eef2f7`, blueprint ink `#1b4f9c`, faint grid background; **IBM Plex Mono** labels + Inter body; thin schematic rules, boxed cells, coordinate-style metadata. Precise, CAD/pipeline feel.
4. **Soft** — consumer / light. Warm off-white `#fbfaf7`, pastel per-category tints, big rounded cards (radius 18), soft shadows; **Nunito** rounded sans throughout. Friendly, approachable, playful.
5. **Studio** — personas-derived / dark. Background `#0a0e14`, surface `rgba(255,255,255,0.05)` + `blur(12px)` glass, cyan primary `#22d3ee`; **Inter** + **JetBrains Mono**; semantic type roles, 4-tier elevation shadows, comfortable density, `active:scale-[0.98]` press. Clean, engineered SaaS.

## Components

| File | Responsibility |
|------|----------------|
| `src/app/layout/page.tsx` | `/layout` route — mounts the lab (client) |
| `src/components/layout-lab/LayoutLab.tsx` | tab switcher + variant state; passes shared data to the active variant |
| `src/components/layout-lab/useLabCatalogData.ts` | derives `LabGroup[]` (category → catalogs with label/description/total/verified) from `CATALOG_SECTIONS` × `catalogStore` |
| `src/components/layout-lab/fonts.ts` | `next/font/google` imports (Fraunces, Oswald, IBM_Plex_Mono, Nunito, Inter, JetBrains_Mono) exposing `.className` per variant |
| `src/components/layout-lab/variants/{Atelier,Forge,Blueprint,Soft,Studio}.tsx` | the 5 identity components — each receives `{ groups }`, fully self-styled |

Each variant component takes the identical `LabGroup[]` prop and renders header + category sections + catalog cards/rows with hover + a selectable active state (visual only). No routing, no entity detail, no persistence.

## Data

`LabGroup = { category: string; catalogs: { catalogId, label, description, total, verified }[] }`, grouped from `CATALOG_SECTIONS` (label/category/description) joined with `catalogStore.entitiesByCatalog` counts — the same source the real hub + Live State use, so the prototypes show real catalog data.

## Scope / out of scope

- **In:** the `/layout` route, the 5 self-styled variants, the shared data hook + fonts, a tab switcher, hover/active states.
- **Out:** changing the production shell / homepage / Mission Control; entity-detail or composition editing surfaces (the *next* step, informed by the chosen identity); persistence; responsive polish beyond reasonable desktop.

## Testing

A light smoke test: `/layout`'s `LayoutLab` renders, shows all 5 tab labels, defaults to one variant, and switching tabs renders the new variant (and the catalog content appears). Variants are visual — judged in-browser by the operator, not asserted pixel-by-pixel.

## Invariants

Branch-local commits; `@/` imports; variants are self-contained (no Dzin-token dependency) so they don't perturb the app theme; `logger` not `console`; co-author tag.
