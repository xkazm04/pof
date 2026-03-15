# Roadmap: Dzin Integration Prototype

## Overview

This prototype validates Dzin's density-aware panel framework inside PoF by rebuilding the AbilitySpellbook's 10 sections as standalone Dzin panels with tri-density rendering (micro/compact/full), composable layout templates, and smooth transitions. The work progresses from vendoring Dzin and bridging themes, through proving the pattern with one panel end-to-end, to building all 10 panels, and finally wiring up the full layout engine with polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Vendor Dzin source, install deps, bridge theme tokens to PoF's design system (completed 2026-03-14)
- [x] **Phase 2: First Panel Vertical Slice** - Prove the density pattern end-to-end with one panel on `/prototype` route (completed 2026-03-14)
- [x] **Phase 3: All Panels** - Build remaining 9 panels at all 3 densities with panel registry and data wiring (completed 2026-03-14)
- [ ] **Phase 4: Layout Engine & Polish** - Layout templates, composition presets, animated transitions, cross-panel interaction

## Phase Details

### Phase 1: Foundation
**Goal**: Dzin source is vendored, compiles cleanly, and its visual tokens map to PoF's existing dark theme
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. `import { useDensity } from '@/lib/dzin'` resolves and `npm run typecheck` passes with zero Dzin-related errors
  2. `npm run build` completes successfully with Dzin modules included
  3. A test element with `data-dzin-density="compact"` renders using PoF's dark theme colors (surfaces, borders, text) -- no Dzin default palette visible
  4. Tailwind utility classes `density-micro:`, `density-compact:`, `density-full:` apply styles conditionally based on `data-dzin-density` attribute
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Vendor Dzin source and install fast-json-patch
- [x] 01-02-PLAN.md — Theme bridge CSS and Tailwind density variants

### Phase 2: First Panel Vertical Slice
**Goal**: One AbilitySpellbook section (Core) renders at all 3 density levels inside a Dzin layout on the `/prototype` route, proving the full integration pattern
**Depends on**: Phase 1
**Requirements**: DENS-01, DENS-02, DENS-12, INTG-01, INTG-02
**Success Criteria** (what must be TRUE):
  1. Navigating to `/prototype` shows a working page with the Core panel rendered inside a DzinLayout grid
  2. The Core panel displays three distinct views: micro (icon + count badge), compact (key stats list), and full (existing rich view) -- not just CSS scaling, fundamentally different content
  3. Resizing the panel slot causes Dzin to automatically reassign density level, and the panel content switches accordingly
  4. The panel consumes live data from PoF's existing stores/hooks via props (not hardcoded mock data)
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — CorePanel component with tri-density rendering and panel registry registration
- [x] 02-02-PLAN.md — Prototype page with DzinLayout and dual-mode density controls

### Phase 3: All Panels
**Goal**: All 10 AbilitySpellbook sections render as Dzin panels at micro/compact/full densities with a complete panel registry
**Depends on**: Phase 2
**Requirements**: DENS-03, DENS-04, DENS-05, DENS-06, DENS-07, DENS-08, DENS-09, DENS-10, DENS-11, INTG-04
**Success Criteria** (what must be TRUE):
  1. All 10 AbilitySpellbook sections (Core, Attributes, Tags, Abilities, Effects, Tag Deps, Effect Timeline, Damage Calc, Tag Audit, Loadout) each render at micro, compact, and full density with distinct content per level
  2. Each panel is registered in the panel registry with correct metadata (type, label, role, sizeClass, densityModes)
  3. Panel chrome (borders, backgrounds, headers) visually matches PoF's existing dark theme across all 10 panels
  4. Swapping any panel between density levels shows the correct summary metric at micro, intermediate detail at compact, and full interactive view at full
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Attributes, Tags, and Abilities panels (data-driven sections)
- [x] 03-02-PLAN.md — Effects, Tag Deps, and Effect Timeline panels (visualization-heavy sections)
- [x] 03-03-PLAN.md — Damage Calc, Tag Audit, and Loadout panels (mixed-content sections)

### Phase 4: Layout Engine & Polish
**Goal**: Users can switch between layout templates and composition presets with animated transitions, and panels interact with each other
**Depends on**: Phase 3
**Requirements**: DENS-13, LAYT-01, LAYT-02, LAYT-03, LAYT-04, LAYT-05, LAYT-06, INTG-03
**Success Criteria** (what must be TRUE):
  1. User can switch between at least 4 layout templates (split-2, grid-4, primary-sidebar, studio) and panels rearrange into the new grid configuration
  2. Layout template picker shows visual minimap-style thumbnails and composition preset switcher allows one-click workspace changes
  3. Switching layout templates and switching density levels both animate smoothly (no layout jank, no content flash)
  4. Selecting an entity in one panel (e.g., an ability) highlights or filters related data in companion panels
  5. At least 3 composition presets (e.g., "Ability Overview", "Combat Debug", "Full Spellbook") are available and apply named panel+layout combos
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Foundation modules (animation constants, presets, selection context, entity relations) and panel density/selection updates
- [ ] 04-02-PLAN.md — Prototype page rewrite with template picker, preset switcher, FLIP animations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-14 |
| 2. First Panel Vertical Slice | 2/2 | Complete   | 2026-03-14 |
| 3. All Panels | 3/3 | Complete   | 2026-03-14 |
| 4. Layout Engine & Polish | 1/2 | In Progress|  |
