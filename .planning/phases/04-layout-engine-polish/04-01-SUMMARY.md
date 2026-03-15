---
phase: "04"
plan: "01"
subsystem: dzin-layout-engine
tags: [animation, composition-presets, cross-panel-selection, density-transitions]
dependency_graph:
  requires: [panel-definitions, dzin-core-types]
  provides: [animation-constants, composition-presets, selection-context, entity-relations]
  affects: [all-10-dzin-panels]
tech_stack:
  added: [framer-motion-AnimatePresence]
  patterns: [density-crossfade, cross-panel-selection-context, entity-relation-map]
key_files:
  created:
    - src/lib/dzin/animation-constants.ts
    - src/lib/dzin/composition-presets.ts
    - src/lib/dzin/selection-context.tsx
    - src/lib/dzin/entity-relations.ts
  modified:
    - src/components/modules/core-engine/dzin-panels/CorePanel.tsx
    - src/components/modules/core-engine/dzin-panels/AttributesPanel.tsx
    - src/components/modules/core-engine/dzin-panels/TagsPanel.tsx
    - src/components/modules/core-engine/dzin-panels/AbilitiesPanel.tsx
    - src/components/modules/core-engine/dzin-panels/EffectsPanel.tsx
    - src/components/modules/core-engine/dzin-panels/TagDepsPanel.tsx
    - src/components/modules/core-engine/dzin-panels/EffectTimelinePanel.tsx
    - src/components/modules/core-engine/dzin-panels/DamageCalcPanel.tsx
    - src/components/modules/core-engine/dzin-panels/TagAuditPanel.tsx
    - src/components/modules/core-engine/dzin-panels/LoadoutPanel.tsx
decisions:
  - "Entity relations map uses static bidirectional ability<->tag mappings rather than dynamic resolution"
  - "Selection context uses React Context + useState (not Zustand) since scope is per-composition, not global"
  - "TagAuditPanel uses category-name prefix matching for selection rather than exact entity lookup"
metrics:
  duration: "7min"
  completed: "2026-03-15"
---

# Phase 04 Plan 01: Foundation Modules + Panel Density Crossfade & Selection Summary

AnimatePresence density crossfade on all 10 panels with React Context-based cross-panel selection highlighting using static entity relation maps

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create foundation modules (animation constants, composition presets, selection context, entity relations) | a7b762a | 4 created |
| 2 | Add density crossfade animation and selection highlighting to all 10 panels | 1ffae49 | 10 modified |

## What Was Built

### Foundation Modules (Task 1)

1. **animation-constants.ts** -- `DZIN_TIMING` object with LAYOUT (0.3s), DENSITY (0.2s), HIGHLIGHT (0.15s) constants plus `LAYOUT_EASE` Material Design easing curve. Separate from PoF's UI_TIMEOUTS.

2. **composition-presets.ts** -- 3 named presets: "Ability Overview" (split-2), "Combat Debug" (grid-4), "Full Spellbook" (studio). Each preset specifies a templateId and panel directives array.

3. **selection-context.tsx** -- `DzinSelectionProvider` with toggle-on-reclick behavior (clicking same entity clears selection). Exports `useDzinSelection` hook.

4. **entity-relations.ts** -- Static bidirectional map between 5 abilities (MeleeAttack, Fireball, Dodge, HealOverTime, Shield) and their related GAS tags. Exports `isRelatedToSelection` helper.

### Panel Updates (Task 2)

- All 10 panels wrapped with `AnimatePresence mode="wait"` + `motion.div` keyed by density for smooth crossfade transitions
- 6 panels (AbilitiesPanel, TagsPanel, CorePanel, EffectsPanel, TagDepsPanel, TagAuditPanel) respond to cross-panel selection state with opacity dimming on unrelated items
- AbilitiesPanel and TagsPanel have full clickable selection on individual items with ring highlight
- CorePanel, EffectsPanel, TagDepsPanel, TagAuditPanel use contextual relation mapping for dimming

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate key in entity relations map**
- **Found during:** Task 1
- **Issue:** `tag:Damage.Magical` appeared twice in ENTITY_RELATIONS object
- **Fix:** Removed duplicate entry
- **Files modified:** src/lib/dzin/entity-relations.ts
- **Commit:** a7b762a

## Verification

- TypeScript typecheck passes (0 errors in modified files)
- ESLint passes (0 errors, only pre-existing hex color warnings)
- All 4 new library files export documented interfaces
- All 10 panels use AnimatePresence + motion.div for density crossfade
- 6 panels use useDzinSelection for selection-aware highlighting
