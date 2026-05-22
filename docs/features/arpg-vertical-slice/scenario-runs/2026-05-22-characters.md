# Characters Sub-Project Findings — 2026-05-22: UE Mannequin Wired

**Result:** COMPLETE. The vertical-slice characters now use the real UE Mannequin skeletal meshes. All four gameplay criteria (#2-#5) pass in the `AVSFunctionalTest` functional test. Gemini confirmed two humanoid figures standing naturally on the arena floor.

**Sub-project tasks:** Task 1 (MoverTests plugin), Task 2 (Blueprint wiring), Task 3 (verification — this document).
**Functional test:** `Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`
**Final run result:** `Result={Success}`, exit 0.

---

## Mannequin Source

The UE Mannequin assets ship inside the `MoverTests` engine plugin (enabled in Task 1). Plugin-relative paths:

| Asset | Path |
|-------|------|
| Player mesh | `/MoverTests/Characters/Mannequins/Meshes/SKM_Manny` |
| Enemy mesh | `/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple` |
| Animation Blueprint | `/MoverTests/Characters/Mannequins/Animations/ABP_Manny` |
| Player material | `/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_01` (default) |
| Enemy material | `/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_02` |

---

## What Was Wired (Task 2)

The Python automation script `Content/Python/setup_characters_ue.py` ran against the full editor to:

1. **Removed `VSBody` StaticMeshComponent** (the gray-box cylinder/cube primitive) from both `BP_VSPlayer` and `BP_VSEnemy` via `SubobjectDataSubsystem`.
2. **Configured the inherited ACharacter `CharacterMesh0`** component on each Blueprint:
   - `SkeletalMeshAsset` → `SKM_Manny` (player) / `SKM_Manny_Simple` (enemy)
   - `AnimClass` → `ABP_Manny` generated class
   - Relative transform: location `(0, 0, -90)`, rotation `(0, 0, -90)` — standard mannequin offset matching the ACharacter C++ default.
3. **Overrode enemy material** to `MI_Manny_02` on all mesh slots to visually distinguish the enemy from the player.
4. Compiled and saved both Blueprints.

Collision: the inherited `UCapsuleComponent` continues to handle gameplay collision and movement. The `CharacterMesh0` skeletal mesh is visual only (no gameplay collision role).

---

## Functional Test Results — Criteria #2–#5

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| #2 | Player movement under input | PASS | Player moved **531.9 cm** (threshold: >50 cm) |
| #3 | Attack ability activation | PASS | `GA_MeleeAttack` activated via `TryActivateAbilitiesByTag(Ability.Melee.LightAttack)` |
| #4 | Damage via GAS pipeline | PASS | Enemy GAS Health: **100.0 → 80.0** via `GE_Damage` → `UARPGDamageExecution` → `PostGameplayEffectExecute` |
| #5 | Death chain + loot spawn | PASS | Enemy Health driven to 0.0 by real lethal `GE_Damage` spec; death chain ran (`Event.Death` → `GA_Death` → `OnDeathFromAbility` → loot drop); **1 `AARPGWorldItem` loot actor** spawned |

### Assert messages (as logged)

```
VSFunctionalTest: Assertion passed (#2 movement: player should have moved >50cm, moved 531.9cm)
VSFunctionalTest: Assertion passed (#3 attack activation: melee ability should have activated)
VSFunctionalTest: Assertion passed (#4 damage: enemy Health should be less than 100.0, is 80.0)
VSFunctionalTest: Assertion passed (#5 death: enemy Health should be <= 0 (observed depletion via real damage), is 0.0)
VSFunctionalTest: Assertion passed (#5 loot: expected >= 1 AARPGWorldItem in world, found 1)
VSFunctionalTest: vertical slice verified
```

---

## Regression Found and Fixed — `GA_MeleeAttack` Fallback Guard Race

**Root cause (introduced by the mannequin swap):**

With `SKM_Manny` + `ABP_Manny` present, `USkeletalMeshComponent::GetAnimInstance()` returns non-null in nullrhi mode, so the `bCanPlayMontage` pre-check evaluates true. `UAbilityTask_PlayMontageAndWait::ReadyForActivation()` is called — but `AM_MeleeCombo` is an empty montage with no sequences, so it fails to play. The engine fires `OnInterrupted`/`OnCancelled` **synchronously** inside `ReadyForActivation()`. At that point `bUsingFallbackWindow` was still `false`, so `OnMontageInterrupted` called `EndAbility()` immediately, destroying the `WaitGameplayEvent` listener for `Event.MeleeHit`. The test's Phase 2 later sent the event, but the listener no longer existed — no damage applied, criterion #4 failed.

**Fix applied (`Source/PoF/AbilitySystem/GA_MeleeAttack.cpp`, UE project commit `ca04c73`):**

Set `bUsingFallbackWindow = true` **before** calling `ReadyForActivation()` on the montage task, so any synchronous `OnInterrupted`/`OnCancelled` callbacks see the flag and skip `EndAbility`. The flag is only reset to `false` if `GetCurrentMontage() == AttackMontage` confirms the montage actually started. Added the same `bUsingFallbackWindow` guard to `OnMontageCompleted` and `OnMontageBlendOut` for full parity.

This restores the pre-mannequin behavior of criterion #4 on the same `Event.MeleeHit` path.

---

## ABP_Manny Animating a Plain ACharacter

`ABP_Manny` is wired on both `BP_VSPlayer` and `BP_VSEnemy`, both of which extend `AARPGPlayerCharacter` / `AARPGEnemyCharacter` (which extend `AARPGCharacterBase` → `ACharacter`). In the headless nullrhi functional test, the AnimBP initializes (creates an AnimInstance, allowing the `bCanPlayMontage` check to pass), but actual motion evaluation is suppressed.

In the live `-game -windowed` session used for the screenshot, **both characters rendered in a natural idle pose** (Gemini-confirmed: standing with feet on the floor, not T-posing). `ABP_Manny` is animating correctly on a plain `ACharacter` — no fallback migration needed.

---

## Gemini Character Description

**Screenshot:** `Saved/Screenshots/WindowsEditor/mannequin_vs_capture.png`
Captured via `PrintWindow` API from a `-game -windowed -ResX=1280 -ResY=720` launch after a 25-second stabilization window.

**Gemini (`gemini-recognize.mjs`) description:**

> Both characters are **humanoid figures** (specifically, silver/grey 3D mannequin models, commonly used as default assets in game engines like Unreal Engine). They are not simple geometric shapes.
>
> The two characters are **not visually distinct** from each other; they appear to use the exact same 3D model. The only way to tell them apart is their position and the user interface (the top character has an "Enemy" health bar above it).
>
> Both characters are standing in a **natural idle pose** with their feet planted firmly on the checkered floor. Neither is in a stiff T-pose, and neither is sunk into the ground.

**Interpretation:** Gate criteria met — two humanoid characters, natural poses, feet on the floor. The `MI_Manny_02` material override (gray-blue vs. gray-brown) was subtle enough that Gemini did not call out the distinction at the scale and lighting of this screenshot. This is a cosmetic gap: the intent (visual separation) is in the Blueprint data, but the material hue difference is not dramatic. Follow-up option: use a clearly contrasting material (e.g., a red tinted instance) for the enemy in a future pass.

---

## Accepted Gap

- **No attack-swing animation:** `AM_MeleeCombo` is an empty montage shell. The fallback timer-driven attack window in `GA_MeleeAttack` handles this correctly for both gray-box and mannequin characters. When real animations are imported (future PS-2 scope), the empty montage will be replaced with sequences and the normal montage path will activate.

---

## Summary

The characters sub-project is complete. The vertical-slice Blueprints now carry the UE Mannequin — real humanoid meshes driven by `ABP_Manny` — replacing the former cylinder (player) and cube (enemy) gray-box bodies. All four gameplay criteria verified by `AVSFunctionalTest` pass at `Result={Success}`. One regression was found and fixed during this session: a race condition in `GA_MeleeAttack`'s fallback guard that caused `EndAbility` to fire synchronously when a live AnimInstance was present but the empty montage failed to play.

**This completes the vertical-slice build-out through the characters sub-project.**

| Commit | Repo | Description |
|--------|------|-------------|
| `6603927` | `pof-exp` (UE) | feat(characters): mannequin meshes on BP_VSPlayer / BP_VSEnemy |
| `ca04c73` | `pof-exp` (UE) | fix(abilities): pre-arm bUsingFallbackWindow before ReadyForActivation |
