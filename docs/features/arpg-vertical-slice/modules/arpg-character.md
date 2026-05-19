# `arpg-character` — vertical-slice readiness

## 1. One-line purpose

Provides player character class hierarchy, input handling, camera, movement (walk/sprint/dodge), and spawning infrastructure for the aRPG.

## 2. Files of record

- **UI:** `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/index.tsx:1-350` — Blueprint tab with overview, input, movement, and simulator subtabs; displays character properties, input bindings, dodge trajectories, and balance metrics
- **API routes (if any):** _(none)_
- **Prompt builders (if any):** _(none)_
- **Module registry entry:** `src/lib/module-registry.ts:23-140` (checklist items ac-1 through ac-5 covering character foundation, sprint, dodge, game mode/instance, and movement tuning)
- **Store slice:** _(none)_ — Project/checklist progress stored in `src/stores/moduleStore.ts` and `src/stores/projectStore.ts` but no arpg-character-specific store slice
- **Feature definitions:** `src/lib/feature-definitions.ts:170-181` (10 features: AARPGCharacterBase, AARPGPlayerCharacter, AARPGPlayerController, Enhanced Input actions, Isometric camera, WASD movement, Sprint system, Dodge/dash, AARPGGameMode, UARPGGameInstance)
- **Evaluator prompts:** `src/lib/evaluator/module-eval-prompts.ts:55-71` (3-pass structure/quality/performance checks for character architecture, input binding patterns, movement component tuning)

## 3. Vertical-slice relevance

Required UE5 artifact: **`AARPGCharacterBase` C++ class with `UCharacterMovementComponent` + camera + spring arm; spawns in PIE level**

Acceptance bullets for this module specifically:
- [ ] AARPGCharacterBase exists (abstract ACharacter subclass with shared character logic)
- [ ] AARPGPlayerCharacter spawns in PIE with camera + spring arm (isometric, mouse-wheel zoomable)
- [ ] WASD moves character on flat terrain; character rotates smoothly toward movement direction
- [ ] Left Shift sprint increases speed; Space dash applies velocity impulse
- [ ] AARPGGameMode sets correct default pawn/controller classes
- [ ] Code compiles without errors; no blocker warnings

## 4. Current state

Module is marked "Mature" in `docs/harness/harness-scenario.md` (2/2 checklist items, 10 implementation features, 4.4/5 quality score). CharacterBlueprint UI provides overview subtab displaying class hierarchy, camera profiles, scaling preview, input bindings table, and movement simulator. Five checklist items (ac-1 through ac-5) cover character foundation (base + controller + input + isometric camera + WASD), sprint system, dodge/dash, game mode/instance creation, and movement tuning. Feature prerequisites establish that animation (arpg-animation) and GAS (arpg-gas) depend on arpg-character::AARPGCharacterBase, making it a foundational module. No known blockers to vertical-slice success (checklist completion suggests all core features implemented).

## 5. Gaps blocking the slice

_(no gaps blocking the vertical slice)_

## 6. testId touchpoints

The CharacterBlueprint component renders UI subtabs (Overview, Input, Movement, Simulator) but those surfaces are read-only dashboards for inspection, not Playwright-clicked controls. The module's vertical-slice responsibility is *output* (UE5 C++ classes that spawn and behave correctly in PIE), not *input* (PoF UI controls). The operator will verify character behavior in the UE5 editor/packaged build, not drive testIds in the PoF UI for this module.

_(no Playwright-touched controls in this module)_
