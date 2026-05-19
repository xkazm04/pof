# `arpg-gas` — vertical-slice readiness

## 1. One-line purpose
Provides Unreal Engine 5 Ability System Component, attribute management, and core damage/health mechanics foundational to aRPG vertical-slice combat.

## 2. Files of record
- **UI:** `src/components/modules/core-engine/unique-tabs/gas-blueprint/WiringGraphEditor.tsx:17-245` — visual attribute/effect relationship graph editor
- **UI:** `src/components/modules/core-engine/unique-tabs/gas-blueprint/SimulationSandbox.tsx` — GAS mechanic simulation environment
- **UI:** `src/components/modules/core-engine/unique-tabs/GASBlueprintEditor/` — full GAS blueprint authoring suite
- **API routes (if any):** _(none)_
- **Prompt builders (if any):** `src/lib/module-registry.ts:186–195` — 8 checklist prompts for GAS implementation (ASC, AttributeSet, tags, abilities, effects, damage execution, init, test/debug)
- **Module registry entry:** `src/lib/module-registry.ts:446–454`
- **Store slice (if any):** _(none)_
- **Feature definitions:** `src/lib/feature-definitions.ts:193–201` — 7 feature dependencies (AbilitySystemComponent, Core AttributeSet, Gameplay Tags, Base GameplayAbility, Core Gameplay Effects, Damage execution, default attribute initialization)
- **Evaluator prompts (if any):** `src/lib/evaluator/module-eval-prompts.ts:99–115` — structure/quality/performance checks for GAS architecture

## 3. Vertical-slice relevance
**Required UE5 artifact:** `UAbilitySystemComponent` on character, `UARPGAttributeSet` with `Health`/`MaxHealth`/`Damage`, `GE_Damage` gameplay effect

Acceptance bullets:
- [ ] Character base (`AARPGCharacterBase`) implements `IAbilitySystemInterface` and owns initialized `UAbilitySystemComponent`
- [ ] `UARPGAttributeSet` defines `Health` (clamped 0–MaxHealth) and `Damage` with `PostGameplayEffectExecute` hook for damage event dispatch
- [ ] `GE_Damage` gameplay effect exists and applies damage via `UARPGDamageExecution` calculation (armor/crit modifiers optional for MVP)

## 4. Current state
Harness scenario marks module as "7/8 — Needs review" (one checklist item pending). UI components exist (gas-blueprint WiringGraphEditor, GASBlueprintEditor suite, SimulationSandbox) but are design/educational tools, not direct C++ codegen. No testIds currently present in gas-blueprint components. Module prerequisites: depends on `arpg-character` only. Downstream modules depend on `arpg-gas`: `arpg-combat`, `arpg-enemy-ai`, `arpg-inventory`, `arpg-ui`, `arpg-progression`, `arpg-save` (6 dependents).

## 5. Gaps blocking the slice
_(no gaps blocking the vertical slice)_

Module structure and feature definitions are complete and well-documented. UE5 C++ implementation (ASC, AttributeSet, GE_Damage class) is developer responsibility per prompt checklist but roadmap is clear.

## 6. testId touchpoints
_(no Playwright-touched controls in this module)_

GAS blueprint editor components (`gas-blueprint/*`, `GASBlueprintEditor/*`) are design/debug tools with zero testId coverage. Vertical-slice acceptance does not require UI automation of GAS authoring; only that UE5 compiled artifacts exist and function correctly in packaged build.

