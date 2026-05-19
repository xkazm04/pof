# `arpg-animation` — vertical-slice readiness

## 1. One-line purpose

Provides UARPGAnimInstance with locomotion blend space + attack montage system to drive character animation and combo mechanics in UE5.

## 2. Files of record

- **UI:** `src/components/modules/content/animations/AnimationChecklist.tsx:1-547` — Interactive 8-step checklist UI with expand/collapse step cards, progress tracking, code generation buttons
- **UI:** `src/components/modules/content/animations/AnimationsView.tsx:1-168` — Main module view with 4 tabs: Setup Guide, State Machine, Combo Designer, Ask Claude
- **Prompt builders:** `src/lib/prompts/animation-checklist.ts:1-54` — Builds step-by-step prompts for commandlet, Mixamo import, AnimBP, montages, notifies
- **Module registry entry:** `src/lib/module-registry.ts:143-185` (checklist), `src/lib/module-registry.ts:297-301` (quick actions), `src/lib/module-registry.ts:436-444` (module def)
- **Feature definitions:** `src/lib/feature-definitions.ts:182-192` — 9 features: UARPGAnimInstance, Locomotion Blend Space, Animation state machine, Attack montages, Anim Notify classes, Motion Warping, Root motion toggle, Mixamo import & retarget pipeline, Asset automation commandlet
- **Evaluator prompts:** _(none)_

## 3. Vertical-slice relevance

Required UE5 artifact: **`UARPGAnimInstance` with locomotion blend space + one attack montage; AnimBP wired to character**

Acceptance bullets:
- [ ] UARPGAnimInstance created with Speed, Direction, IsInAir, bIsAttacking variables updated in NativeUpdateAnimation
- [ ] BS1D_Locomotion generated via commandlet (FProperty reflection on BlendParameters); sample anims assignable (Idle→0, Walk→200, Run→600)
- [ ] AM_MeleeCombo montage shell created with 3 linked sections (Attack1→Attack2→Attack3); skeletons/anims assigned in-editor
- [ ] AnimBP state machine wired: Locomotion(blend space) ↔ Attacking(montage) transitions via bIsAttacking
- [ ] Character can move (WASD) and trigger attack (LMB) with montage playing; combo chains work in PIE

## 4. Current state

Harness reports module 6/7 with avg quality 3.5/5. Comprehensive 8-step UI checklist exists covering commandlet (UAnimAssetCommandlet verified UE 5.7.3, 0.06s for 8 assets), Mixamo download/import, AnimBP creation (note: state machine requires editor, not automatable), montage shells with linking, Anim Notify classes, Motion Warping, root motion config, and IK Retargeter Python API batch workflow. All steps have detailed instructions, external links, and code generation prompts. No gaps blocking core vertical-slice content — both commandlet-automatable assets and mandatory editor work are documented.

## 5. Gaps blocking the slice

_(no gaps blocking the vertical slice)_

## 6. testId touchpoints

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| AnimationChecklist.tsx | Step card button (aa-1 through aa-8) | `pof-module-arpg-animation-step-<stepId>` | No | Non-conforming: no testIds in StepCard or ANIMATION_STEPS array |
| AnimationChecklist.tsx | Expand/collapse chevron | `pof-module-arpg-animation-toggle-<stepId>` | No | testId missing |
| AnimationChecklist.tsx | "Execute Process" button | `pof-module-arpg-animation-generate-<stepId>` | No | testId missing |
| AnimationChecklist.tsx | "Verify Complete" checkbox | `pof-module-arpg-animation-mark-<stepId>` | No | testId missing |
| AnimationsView.tsx | Setup Guide tab | `pof-module-arpg-animation-tab-setup` | No | Extra tabs in ReviewableModuleView lack testIds |
| AnimationsView.tsx | State Machine tab | `pof-module-arpg-animation-tab-states` | No | testId missing |
| AnimationsView.tsx | Combo Designer tab | `pof-module-arpg-animation-tab-combo-ai` | No | testId missing |
| AnimationsView.tsx | Ask Claude tab | `pof-module-arpg-animation-tab-ask` | No | testId missing |
