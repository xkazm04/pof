# Requirements: Dzin Integration Prototype

**Defined:** 2026-03-14
**Core Value:** Panels adapt gracefully across density levels (micro/compact/full) while maintaining composable layouts and smooth transitions.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: Dzin source copied into `src/lib/dzin/` with only needed modules (density, layout, panel, registry, theme, types)
- [x] **FOUND-02**: `fast-json-patch` dependency installed and Dzin compiles cleanly in PoF's TypeScript/Next.js build
- [x] **FOUND-03**: Theme bridge CSS maps `--dzin-*` tokens to PoF's existing CSS variables and chart-colors system
- [x] **FOUND-04**: Tailwind CSS 4 custom variants for `density-micro`, `density-compact`, `density-full` targeting `data-dzin-density` attributes

### Density Rendering

- [x] **DENS-01**: Each AbilitySpellbook section registered as a Dzin panel with `PanelDefinition` (type, label, role, sizeClass, densityModes, inputs, outputs)
- [x] **DENS-02**: Core section panel renders at micro (icon + count badge), compact (key stats list), and full (existing rich view)
- [ ] **DENS-03**: Attributes section panel renders at micro (attribute count), compact (bar chart summary), and full (detailed attribute grid)
- [ ] **DENS-04**: Tags section panel renders at micro (tag count badge), compact (tag list), and full (tag hierarchy tree)
- [ ] **DENS-05**: Abilities section panel renders at micro (ability count), compact (ability name list with cooldowns), and full (ability cards with full details)
- [ ] **DENS-06**: Effects section panel renders at micro (effect count), compact (effect list with durations), and full (effect cards with stacking/calculation details)
- [ ] **DENS-07**: Tag Dependencies section panel renders at micro (dep count), compact (simplified dep list), and full (network graph)
- [ ] **DENS-08**: Effect Timeline section panel renders at micro (timeline span badge), compact (condensed timeline bar), and full (interactive timeline strip)
- [ ] **DENS-09**: Damage Calc section panel renders at micro (DPS badge), compact (pipeline summary), and full (step-by-step calculation flow)
- [ ] **DENS-10**: Tag Audit section panel renders at micro (pass/fail badge), compact (audit summary counts), and full (detailed audit checklist)
- [ ] **DENS-11**: Loadout section panel renders at micro (loadout count), compact (loadout names with slots), and full (interactive loadout builder)
- [x] **DENS-12**: Density is automatically assigned per-slot based on pixel dimensions via Dzin's `assignSlotDensity()`
- [ ] **DENS-13**: Density transitions between levels are animated (smooth content morphing, no layout jank)

### Layout System

- [ ] **LAYT-01**: `DzinLayout` component wired with panel registry and renders combat panels in CSS Grid
- [ ] **LAYT-02**: User can switch between at least 4 layout templates (split-2, grid-4, primary-sidebar, studio)
- [ ] **LAYT-03**: Layout template picker UI shows visual minimap-style thumbnails of each template
- [ ] **LAYT-04**: Switching layout templates animates panel positions smoothly (framer-motion layout/FLIP)
- [ ] **LAYT-05**: At least 3 composition presets defined (e.g., "Ability Overview", "Combat Debug", "Full Spellbook")
- [ ] **LAYT-06**: Composition preset switcher UI allows one-click workspace changes

### Integration

- [x] **INTG-01**: `/prototype` route hosts the Dzin demo page, isolated from existing PoF module views
- [x] **INTG-02**: Panels consume data from PoF's existing hooks (`useFeatureMatrix`, module stores) via props
- [ ] **INTG-03**: Selecting an entity in one panel (e.g., an ability) filters/highlights related data in companion panels
- [ ] **INTG-04**: Dzin panel chrome (borders, backgrounds, headers) visually matches PoF's existing dark theme

## v2 Requirements

### Evaluation

- **EVAL-01**: Side-by-side comparison mode toggling between Dzin and current AbilitySpellbook
- **EVAL-02**: Performance benchmarks comparing Dzin panels vs current implementation

### Extended Features

- **EXTD-01**: Density override controls (force specific density per panel)
- **EXTD-02**: Domain-scoped panel filtering (show only combat-domain panels)
- **EXTD-03**: Persistent layout state across page refreshes
- **EXTD-04**: Undo/redo for layout changes via Dzin's state engine

### Expansion

- **EXPN-01**: Apply Dzin to other core-engine submodules (arpg-character, arpg-loot)
- **EXPN-02**: LLM intent routing for AI-driven panel composition
- **EXPN-03**: Chat-driven workspace commands via Dzin's chat system

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-and-drop panel rearrangement | Conflicts with auto-density assignment; massive implementation cost for zero density-validation value |
| User-resizable panel dividers | Conflicts with density-aware auto-sizing; manual resize makes density engine incoherent |
| Floating/detachable panels | Requires portal rendering, z-index management, cross-window state sync -- orthogonal to density validation |
| LLM/AI intent routing | Separate validation track; mixing it in clouds density evaluation |
| Chat-driven panel composition | Significant surface area unrelated to proving density adaptation works |
| Multi-module panel support | Scoped to arpg-combat only; expanding to other modules is a separate effort |
| Responsive breakpoint-based layouts | Conflicts with container-based density; Dzin is deliberately per-slot, not per-viewport |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| DENS-01 | Phase 2 | Complete |
| DENS-02 | Phase 2 | Complete |
| DENS-03 | Phase 3 | Pending |
| DENS-04 | Phase 3 | Pending |
| DENS-05 | Phase 3 | Pending |
| DENS-06 | Phase 3 | Pending |
| DENS-07 | Phase 3 | Pending |
| DENS-08 | Phase 3 | Pending |
| DENS-09 | Phase 3 | Pending |
| DENS-10 | Phase 3 | Pending |
| DENS-11 | Phase 3 | Pending |
| DENS-12 | Phase 2 | Complete |
| DENS-13 | Phase 4 | Pending |
| LAYT-01 | Phase 4 | Pending |
| LAYT-02 | Phase 4 | Pending |
| LAYT-03 | Phase 4 | Pending |
| LAYT-04 | Phase 4 | Pending |
| LAYT-05 | Phase 4 | Pending |
| LAYT-06 | Phase 4 | Pending |
| INTG-01 | Phase 2 | Complete |
| INTG-02 | Phase 2 | Complete |
| INTG-03 | Phase 4 | Pending |
| INTG-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
