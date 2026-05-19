# `input-handling` — vertical-slice readiness

## 1. One-line purpose

Provides Enhanced Input action definitions (`IA_Move`, `IA_Attack`) and mapping context (`IMC_Default`) bound to the character for WASD movement and LMB attack inputs.

## 2. Files of record

- **UI:** `src/components/modules/game-systems/InputView.tsx:1-3` — Simple module view delegating to ReviewableModuleView with registry checklist
- **API routes (if any):** _(none)_
- **Prompt builders (if any):** _(none)_
- **Module registry entry:** `src/lib/module-registry.ts:847-868` — Checklist items ih-1 through ih-6 covering input actions, mapping context, key rebinding, gamepad, input modes, and scenario testing
- **Store slice (if any):** _(none)_
- **Feature definitions:** `src/lib/feature-definitions.ts:379-386` — Six features: Enhanced Input actions, Input Mapping Context setup, Key rebinding system, Gamepad support, Input mode management, Context-sensitive input
- **Evaluator prompts (if any):** _(none)_ — No module-specific eval context in `src/lib/evaluator/module-eval-prompts.ts`

## 3. Vertical-slice relevance

Required UE5 artifact: **Enhanced Input `IA_Move` + `IA_Attack` actions, `IMC_Default` mapping context, bound to the character**

Acceptance bullets for this module specifically:
- [ ] `IA_Move` UInputAction (Axis2D) created and bound to WASD keys via `IMC_Default`
- [ ] `IA_Attack` UInputAction (Digital/bool) created and bound to LMB via `IMC_Default`
- [ ] `IMC_Default` UInputMappingContext adds both actions with correct modifiers and triggers
- [ ] AARPGPlayerController adds `IMC_Default` via Enhanced Input subsystem's `AddMappingContext()` on Possess
- [ ] Character responds to Move input: camera-relative movement updates via `AddMovementInput()`
- [ ] Character responds to Attack input: calls attack ability or montage trigger (verified outside editor in packaged build)

## 4. Current state

The `input-handling` module is defined in the registry with comprehensive checklist items (ih-1 through ih-6) and six feature definitions covering Enhanced Input actions, mapping context setup, key rebinding, gamepad support, input modes, and context-sensitive input stacking. The InputView component is a factory-created simple module view that renders the standard ReviewableModuleView with the full checklist and quick actions from the registry. No implementation code or UI-specific tests currently exist — the module is purely a PoF documentation and task-tracking artifact. The vertical slice requires only the first two checklist items (Enhanced Input Actions ih-1 and Input Mapping Context ih-2) to be complete.

## 5. Gaps blocking the slice

- (severity: M) (blocking: Y) (category: prompt-defect) — Checklist item ih-1 prompt mentions `IA_Jump`, `IA_Interact`, `IA_PrimaryAttack`, `IA_SecondaryAttack`, `IA_Dodge`, `IA_Sprint`, `IA_Pause`, `IA_ToggleInventory` but vertical slice requires only `IA_Move` and `IA_Attack`. Prompt should be narrowed to avoid scope creep. Notes: `src/lib/module-registry.ts:862`.
- (severity: M) (blocking: Y) (category: prompt-defect) — Checklist item ih-2 prompt references "all gameplay actions" and many features (Jump, Interact, Sprint, Dodge) not needed for vertical slice. Should focus on Move and Attack only. Notes: `src/lib/module-registry.ts:863`.
- (severity: L) (blocking: N) (category: testId-missing) — InputView and ReviewableModuleView checklist items lack testIds for Playwright navigation of checklist completion. Example: `pof-module-input-handling-checklist-item-${itemId}`. Notes: `src/components/modules/game-systems/InputView.tsx:1-3`, `src/components/modules/shared/ReviewableModuleView.tsx`.

## 6. testId touchpoints

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-1 (Define Enhanced Input Actions) | `pof-module-input-handling-checklist-item-ih-1` | N | Mark item complete after IA_Move + IA_Attack created |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-2 (Create Input Mapping Context) | `pof-module-input-handling-checklist-item-ih-2` | N | Mark item complete after IMC_Default bound to controller |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-3 (Implement key rebinding) | `pof-module-input-handling-checklist-item-ih-3` | N | Out of scope for slice; left unchecked |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-4 (Add gamepad support) | `pof-module-input-handling-checklist-item-ih-4` | N | Out of scope for slice; left unchecked |
| `src/components/modules/game-systems/InputView.tsx` | Checklist complete button | `pof-module-input-handling-complete-btn` | N | Submit checklist completion (only if ih-1 & ih-2 done) |
