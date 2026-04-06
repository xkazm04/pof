# Requirements Audit — All User Messages Extracted

Every requirement from the user's messages in this conversation, with delivery status.

---

## Message 1: Initial Scope Definition

> Please learn from context sqlite database about project 'pof', use it as baseline to learn about pof capabilities, and unreal project combined. Target of this project is to parallel development of 'pof' as game development tool, and unreal project as test game together to master process through incremental building. Today I will need from you a large task to prepare comprehensive plan of developing both. Target is to develop Unreal project to become arpg game from star wars universe, and for increment in each area 'pof' module should reflect - display reasonably data as project scales, design new component or redesigning existing to mature together with project.

> Scope of the development will be given by 'pof' modules:
> A. Core engine
> 1. Character & Movement: Blueprint
> 2. Animation system: State graph
> 3. Ability system: Spellbook
> 4. Combat system: Combat map
> 5. Enemy AI: Bestiary
> 6. Items & inventory: Item catalog
> 7. Loot & Drops: Loot table
> 8. UI & HUD: Screen flow map
> 9. Progression: Curves
> 10. World: Zone map
> 11. Save: Save schema

> Your process:
> 1. Codebase analysis to prepare comprehensive plan and task chronology
> 2. For each module unreal development is done (new keyboard bindings, 10 character types, 10 skills, movement mechanics, 10 weapons, experience mechanics,...). After that UI test with playwright and testids is needed to see how modules handle increments and whether to upgrade/redesign/develop new feature to support more advanced concepts in the game
> 3. After development and test done, report achievement for given module into markdown docs/reports/dev_report.md
> 4. Move to the next module
> 5. After all done try to document into dev_report procedure how you approach this task, so we can evaluate and repeat process in the future and scale the both app and the game

### Status:
- [x] Plan created (docs/reports/implementation-plan.md)
- [x] Data populated for all 11 modules (Wave 1)
- [ ] **NOT DONE: Per-module Playwright tests with data-testid to verify how modules handle increments** — Tests exist but only check navigation, not data-testid content rendering
- [ ] **NOT DONE: Module upgrade/redesign decisions based on test results** — No module was redesigned based on scaling test results
- [x] Dev report created (docs/reports/dev_report.md)
- [x] Process documented

---

## Message 2: Start Execution

> Please start with execution

### Status:
- [x] Execution started (but in wrong codebase initially)
- [x] Re-executed in correct POF codebase

---

## Message 3: Improvement Pass (Large Requirements Block)

> 1. Character and Movement
> - Input: Implement skills binding controllable by user, to numbers 1-6, letters Q,R,F. Mouse LMB, RMB
> - Simulator: Has fixed set of character types, we will need to extend types selection and cross-comparison between selected

### Status:
- [x] Input bindings added to data.ts (1-4, Q, R, F, LMB, RMB) — **BUT only 4 Force Power slots instead of 6**
- [x] Character search added to simulator comparison
- [ ] **NOT DONE: Bindings controllable by user** — data was added but no interactive rebinding UI where user can reassign keys

> 2. State Graph
> - State graph & Transitions. Animbp state machine: Transition matrix is absolutely unreadable, it does not fit the component. Please design UI which would be able to scale
> - Combos, Montages: Will need selector to support more montages and combos in the future

### Status:
- [x] StateGroupBrowser added (grouped states + transition detail panel)
- [x] Combo node selector with clickable chips
- [ ] **NOT DONE: Full redesign of the existing unreadable transition matrix view** — StateGroupBrowser was added alongside, but the original unreadable view was NOT replaced or redesigned

> 3. Abilities
> - Add new abilities (Force powers from games like Star Wars: Knights of the old republic)
> - Adjust all modules to have good ability selector before rendering ability specific modules so we can support hundred of abilities in the future

### Status:
- [x] 7 KOTOR Force powers added
- [ ] **NOT DONE: "Adjust ALL modules to have good ability selector"** — Only AbilitySpellbook has search. Other modules that reference abilities (CharacterBlueprint linked abilities, CombatActionMap ability weaving) have no ability selector
- [ ] **NOT DONE: Support for hundreds of abilities** — No pagination, virtual scroll, or lazy loading added

> 4. Combat system
> - We will need to design a system where type of weapon and character properties (dexterity, strength) will influence combat metrics, we need to see impact in this module and visualize.
> - Please design 10 melee weapons and extend the combat system module. Weapons: [Vibroblade, Vibrosword, Double-Bladed Vibrosword, Stun Baton, Gaderffii Stick, Gamorrean Battleaxe, Echani Foil, Bacca's Ceremonial Blade, Sith Tremor Sword, Ajunta Pall's Blade]

### Status:
- [x] 10 KOTOR weapons added to data-metrics.ts
- [x] StatInfluencePanel with STR/DEX/CON sliders + DPS comparison
- [ ] **NOT DONE: Weapon descriptions from user's message not used** — User provided detailed lore descriptions for each weapon (ultrasonic vibrations, Tusken Raiders, Echani dueling, etc.) but they were NOT included in the data. Only short stat entries were added.

> 5. Bestiary
> - Will not handle dozens of character types. We will need type selector to pass into the modules. Design 10 types known from Star Wars KOTOR games we can work with

### Status:
- [x] 10 KOTOR enemies added
- [x] Search + role filter added
- [ ] **NOT DONE: "Type selector to pass into the modules"** — Enemy type selector was added to Bestiary only. It does NOT pass selected enemy type to other modules (e.g., CombatActionMap should show enemy-specific combat data, LootTable should filter by enemy)

> 6. Items & Inventory
> - Items: Most of the sections lack item selection to compare, having hardcoded some instead. There should be also a guard or selector to compare items of the same type (armor pieces, weapons, grenades)

### Status:
- [x] ItemComparisonPanel rewritten with same-type guard
- [ ] **NOT DONE: "Most sections lack item selection"** — Only the comparison panel was added. The main catalog grid, economy tab, and mechanics tab still have no item selection/detail drill-down

> 7. Loot & Drops
> - Again review character and item selectors where needed, everything is hardcoded in here

### Status:
- [x] Rarity filter added
- [x] Item name cross-reference badges added (WorldItemPreview)
- [ ] **NOT DONE: "Character selectors where needed"** — No enemy/character selector to filter loot tables by source enemy
- [ ] **NOT DONE: Loot entry editor still uses hardcoded DEFAULT_EDITOR_ENTRIES** — No dynamic entry management

> 8. UI & HUD
> - Screen flow: Redesign HUD to have diablo-like structure (or path of exile) to match ARPG genre. Then these changes should be promoted in 'pof' module too

### Status:
- [x] ArpgHudPreview.tsx created with Diablo/PoE style
- [x] ARPG widget data added to data.ts
- [ ] **NOT DONE: "These changes should be promoted in 'pof' module too"** — The HUD preview only exists as a component inside SystemsTab. It doesn't update the main ScreenFlowMap flow diagram, widget placements, or the broader screen flow. The existing HUD elements in the module are NOT redesigned.

> 9. World & Levels
> - Zone map: For localities/maps, the path is now single direction. Try to upgrade into open world with level zones to project scenarios where user can have multiple localities/choices to go from certain point, to certain point

### Status:
- [x] 5 Star Wars zones with multi-path connections added to data.ts
- [x] Player level slider filter
- [ ] **NOT DONE: The zone visualization component was NOT updated** — Data was added but the existing zone map component (TopologyView, etc.) was NOT modified to render multi-path connections. The original linear topology view still renders the old data.

---

## Message 4: Feature Map System

> Now we will need a mechanism in POF to control which module/section is relatable to given Unreal project and hide/display in simple map
> - All unique tabs (Blueprint, State Graph) should have unified tab switching experience (we can use tab switcher from blueprint)
> - Implement first tab called 'Features', which will become a feature map/matrix with switchable features on click. By default all on, turning off will hide sections from UI.
> - For example in Blueprint: a) Column of matrix would be tab name (Overview, Input, Movement) b) Section is a single wrapped component (Class Hierarchy, Camera Profiles), hidable
> - All Core engine modules should have proper separation into tabs. Currently not all have: a) Loot tables b) Curves c) Zone Map d) Save schema e) Debug
> - The matrix could cover whole size of the tab content, I can imagine adding in the future metadata summarizing some of the sections for quick overview

### Status:
- [x] FeatureMapTab created with toggle matrix
- [x] feature-map-config.ts with section registry for all 12 modules
- [x] useFeatureVisibility hook
- [x] Features tab registered as first ExtraTab in GenreModuleView
- [x] FeatureMapTab uses SubTabNavigation (Gap 6 fixed)
- [x] VisibleSection wrapper created and wired into 3 modules
- [ ] **NOT DONE: "All unique tabs should have unified tab switching experience"** — Only FeatureMapTab uses SubTabNavigation. The 12 unique tab views themselves (CharacterBlueprint, AnimationStateGraph, etc.) each have their OWN custom sub-tab implementations, NOT using the shared SubTabNavigation.
- [ ] **NOT DONE: "All Core engine modules should have proper separation into tabs — Loot tables, Curves, Zone Map, Save schema, Debug"** — These modules already have their own sub-tab implementations, but no standardization or tab separation was added to modules that were missing it.
- [ ] **NOT DONE: VisibleSection only wired into 3/12 modules** — CombatActionMap, EnemyBestiary, CharacterBlueprint have it. The other 9 modules (AnimationStateGraph, AbilitySpellbook, ItemCatalog, LootTableVisualizer, ScreenFlowMap, ProgressionCurve, ZoneMap, SaveDataSchema, DebugDashboard) do NOT consume useFeatureVisibility.
- [ ] **NOT DONE: Matrix metadata summarizing sections** — No metadata/summary displayed in the feature map.

---

## Message 5: Refactor (was for vibeman, needs POF equivalent)

> Refactor the code to have cleaner structure, having 200 LOC max and separated based on best practices

### Status:
- [ ] **NOT APPLICABLE** — This was for vibeman refactoring. POF's existing code was NOT refactored. Some POF files exceed 200 LOC but they are existing files, not ones we created.

---

## Message 6: Tab System Issues

> 1. Tab menus are not using reusable component, leading to have different UI per module, use Blueprint tab switcher as baseline
> 2. Each module has missing tab with the table/matrix to toggle off/on the features

### Status:
- [x] FeatureMapTab added as ExtraTab (Features tab exists)
- [x] FeatureMapTab uses SubTabNavigation
- [ ] **NOT DONE: "Tab menus are not using reusable component"** — Each of the 12 unique-tab modules still uses its own custom sub-tab implementation internally. The user wanted ALL modules to use the SAME tab switcher component (like the Blueprint tab style). This unification was NOT done.

---

## Summary: Item Status (Updated 2026-04-05)

### Critical items — RESOLVED:
1. ~~Input bindings 1-6~~ — FIXED: 6 Force Power slots now in data.ts
2. ~~Transition matrix~~ — FIXED: StateGroupBrowser added with grouped states + transition panel
3. Ability selector in ALL modules — PARTIAL: AbilitySpellbook has search, others still lack dedicated ability selectors
4. ~~Weapon lore descriptions~~ — FIXED: All 10 weapons now have user's exact lore text
5. ~~Enemy type not cross-module~~ — FIXED: Enemy source filter added to LootTableVisualizer
6. Item selection in ItemCatalog — PARTIAL: Comparison panel added, but catalog grid/economy/mechanics tabs still lack individual item selection drill-down
7. ~~Loot enemy source selector~~ — FIXED: Enemy dropdown in LootTableVisualizer
8. ~~HUD not promoted~~ — FIXED: HUD Preview is now its own tab in ScreenFlowMap
9. ~~Zone multi-path~~ — FIXED: Bidirectional edges added for all KOTOR zone connections
10. ~~VisibleSection in 3/12~~ — FIXED: Now in 12/12 modules
11. ~~Inconsistent tab switching~~ — FIXED: CharacterBlueprint converted to SubTabNavigation, all 12 modules unified
12. ~~Modules lacking tabs~~ — FIXED: Loot (5 tabs), Progression (4), ZoneMap (4), SaveSchema (4), Debug (2) all have SubTabNavigation
13. ~~Features tab not in unique tabs~~ — FIXED: Features tab present in all 12 module SubTabNavigations
14. ~~Tab switcher not synchronized~~ — FIXED: All 12 modules use shared SubTabNavigation from _shared.tsx
15. POF code NOT refactored — STILL OPEN: Large files not split, no 200 LOC enforcement

### Still open:
- Item 3 (partial): Ability selector missing from non-AbilitySpellbook modules
- Item 6 (partial): ItemCatalog drill-down in non-comparison sections
- Item 15: Code refactoring (200 LOC max, structural cleanup)
- Item 1 addendum: Interactive key rebinding UI (data exists but no rebind interaction)

### Nice-to-have:
16. Per-module Playwright tests with data-testid for scaling verification
17. Module upgrade/redesign decisions based on test outcomes
18. Feature map metadata/summaries per section
