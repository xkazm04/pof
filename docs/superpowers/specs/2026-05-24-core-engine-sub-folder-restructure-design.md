# Core-engine Sub-folder Restructure (Phase 1)

**Date:** 2026-05-24
**Status:** Approved (Section 1 only — Phase 2 features tracked separately).

## Motivation

The current `src/components/modules/core-engine/unique-tabs/` layout no longer reflects the UI. Each 2nd-level menu item (a sub-module like `arpg-character`, `arpg-combat`, …) renders one main "unique tab" with multiple subtabs, but the per-subtab panels and satellite editors are scattered across ~40 sibling folders. This makes the folder structure unreadable as a map of the UI, and individual `.tsx` files have grown well past what fits cleanly in one screen / in a model's context window.

## Goal

For each of the 12 core-engine menu items, consolidate **all** of its files into one `core-engine/sub_<id-suffix>/` folder with one nested subfolder per subtab. Enforce `.tsx` ≤ 200 LOC by splitting on the way in.

## Folder-name mapping (SubModuleId → new folder)

| SubModuleId       | New folder        | Notes                                  |
|-------------------|-------------------|----------------------------------------|
| arpg-character    | `sub_character`   |                                        |
| arpg-combat       | `sub_combat`      |                                        |
| arpg-animation    | `sub_animation`   |                                        |
| arpg-gas          | `sub_ability`     | menu label is "Ability / Spellbook"   |
| arpg-enemy-ai     | `sub_bestiary`    | menu label is "Bestiary"               |
| arpg-inventory    | `sub_inventory`   |                                        |
| arpg-loot         | `sub_loot`        |                                        |
| arpg-ui           | `sub_ui`          |                                        |
| arpg-progression  | `sub_progression` |                                        |
| arpg-world        | `sub_world`       |                                        |
| arpg-save         | `sub_save`        |                                        |
| arpg-polish       | `sub_debug`       | menu label is "Debug"                  |

## Per-folder layout (illustrated with `sub_character`)

```
core-engine/sub_character/
  index.tsx                         # entry (subtab switch + chrome) — ≤ 200 LOC
  wizard/                           # Phase 2: promoted to subtab
  features/                         # FeaturesTab.tsx
  overview/                         # OverviewTab + panels (PropertyInspector, ClassHierarchy, …)
  input/                            # InputTab + bindings/keyboard/quick-picker
  movement/                         # MovementTab + overview/dodge sections
  playground/                       # was CharacterFeelPlayground/*
  ai-feel/                          # was CharacterFeelOptimizer/*
  simulator/                        # ComparisonMatrix + ArchetypeRadar + predictive/
  attributes/                       # was AttributePointOptimizer/*
  genome/                           # was CharacterGenomeEditor/*
  _shared/
    data.ts, design.tsx, metrics.ts, types.ts, NarrativeBreadcrumb.tsx
```

## Satellite-folder absorption

Every current top-level satellite under `unique-tabs/` is absorbed into the corresponding `sub_*/` (see Section 1 of the brainstorming conversation for the full table). Cross-menu shared utilities stay at the root of `unique-tabs/`:

- `_shared.tsx` (cross-menu UI primitives: TabHeader, NarrativeBreadcrumb, SubTabNavigation, …)
- `_design.tsx`
- `_genome-share/` (used by both character & inventory)
- `charts/`
- `FeatureMapTab.tsx`, `VisibleSection.tsx`, `FeatureInitButton.tsx`, `feature-init-prompts.ts`, `feature-map-config.ts`
- `index.tsx` (the registry — re-targets its imports to `sub_*/`)

## Rules

1. **`.tsx` ≤ 200 LOC.** When the source file exceeds this, split during the move (extract panels/sections).
2. **`.ts` data files exempt** (e.g., the 515-LOC `data.ts` may stay).
3. **One `*Tab.tsx` entry per subtab** in each subtab subfolder; supporting components sit alongside.
4. **Cross-menu shared things stay put** at the root of `unique-tabs/`.

## Execution & safety plan (Phase 1)

- **Concurrency:** Repo is multi-session. Use targeted `git add <path>` only; never `git add -A`. Re-read files before editing. Foreign typecheck failures (e.g., the in-progress `visual-gen/asset-viewer/AssetInspector.tsx` from another session) are NOT mine to fix.
- **Per-menu commit cadence.** One commit per `sub_*` folder. After each: `npx tsc --noEmit` scoped to the affected area passes (foreign failures excluded). Final commit updates the registry + runs full `npm run validate`.
- **History preservation:** prefer `git mv` over write+delete so blame/history follows the file.
- **Imports:** full importer sweep per menu (no permanent backward-compat barrel shims). Find with `grep -r 'from.*OldPath'` and update.
- **Tests:** `src/__tests__/` files that import moved paths are updated in the same commit as the move.
- **Order:** `sub_character` first (reference + Phase 2 lands there), then the other 11 (parallelizable; independent folders, only the registry is shared).

## Phase 2 (separate design)

The 4 Character-tab feature changes (Wizard → subtab, 3-col PropertyInspector, Input categorization with UE C++ schema, Simulator dead-space polish) are designed in a follow-up section after Phase 1 lands.
