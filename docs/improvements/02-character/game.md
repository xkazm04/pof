# 02 · Character — Game Improvements

## Goals

Close the character-pipeline gaps the vertical-slice initiative left: real
attack/death animations on the mannequin skeleton; an enemy that actually
fights back; optional richer character variants; and the foundations for
ever using `UARPGAnimInstance`'s full state machine.

## Improvements

### 1. A real attack animation on the mannequin skeleton

`AM_MeleeCombo` is an empty shell. Replace it with a real montage:
- Download a "Sword Slash" / "Mutant Punch" Mixamo animation (no skin),
  drop into the watched folder (see [[pof-app.md]] §3 for the workflow).
- The existing `Content/Python/mixamo_pipeline.py` retargets it to
  `SK_Mannequin` and creates a real `AnimSequence`.
- Wrap it in a `UAnimMontage` (or reuse `AM_MeleeCombo` if the asset name
  is now real) with one section `Combo1` matching `BP_GA_MeleeAttack`'s
  `ComboSectionNames`.
- Add an `AnimNotifyState_HitDetection` notify covering the swing window —
  the project's `Source/PoF/Animation/AnimNotifyState_HitDetection.{h,cpp}`
  already exists; it fires `Event.MeleeHit` which `GA_MeleeAttack::OnMeleeHit`
  consumes. With this, the **normal path** of `GA_MeleeAttack` works — the
  fallback timer becomes a true fallback, not the only path.

This single change retires the "no attack-swing animation" gap accepted in
PS-1, the HUD sub-project, and Characters.

### 2. A working enemy AI — pure-C++ controller

`AARPGEnemyCharacter` has BT scaffolding but no BT asset. The fast path:
- Author a `AARPGSimpleAIController : AAIController` in
  `Source/PoF/AI/ARPGSimpleAIController.cpp` that runs a small `Tick` loop:
  find a player → move toward it (`MoveToActor` with acceptance radius
  ~150uu) → if within melee range, send `Event.MeleeHit`-equivalent or
  call the enemy's `GA_MeleeAttack` (the same ability the player has, set
  on the enemy via `DefaultAbilities`).
- Set `AARPGEnemyCharacter::AIControllerClass = AARPGSimpleAIController` in
  C++ (or per-BP).
- Result: the enemy approaches and attacks. The slice changes from
  "player attacks passive dummy" to "player vs hostile enemy" — meaningful
  combat.

A Behaviour-Tree version is a follow-up once the BT-asset wall is solved
(out of scope here).

### 3. Make the **player take damage**

Currently the enemy is passive — so the player never takes damage and the
HUD's player health bar sits at full. With (2) above, the enemy hits the
player. Wire the inverse damage path:
- `GA_EnemyMeleeAttack` exists (`Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h`)
  — grant it on the enemy via `DefaultAbilities` and call from the AI tick.
- The PS-1 functional test gains criterion #2b: "player Health drops when
  an enemy hits it" (or as a new ability-level functional test).
- The HUD's player bar now visibly drops in real play.

### 4. A second enemy archetype using `AARPGEnemyCharacter::Archetype`

`AARPGEnemyCharacter::Archetype` is an `EEnemyArchetype` enum (MeleeGrunt /
RangedCaster / Brute) the SP-B-generated code defines. Wire it so a
`BP_VSRangedEnemy` (RangedCaster) uses `GA_EnemyRangedAttack`. Cost:
trivial once (2)+(3) work. Payoff: the slice has *two* enemy types.

### 5. Migrate the standard mannequin (fallback path, document only)

If the `MoverTests` `ABP_Manny` is ever found to be Mover-coupled in a way
that breaks something (it didn't bite in the Characters sub-project but the
risk was flagged), the documented fallback is to migrate the Third-Person
template's `ACharacter`-based mannequin + `ABP_Manny`/`ABP_Quinn` into
`/Game/Characters/Mannequins/`. The Characters spec describes this path;
keep it documented but unimplemented.

### 6. Wire `UARPGAnimInstance` — the proper AnimBP (long-tail)

This is the genuinely hard one. `UARPGAnimInstance` computes
Speed/Direction/state/combat flags richly; it needs an **AnimBP graph** to
drive a state machine, blend space, and Layered-Blend-per-Bone. AnimBP
graphs are binary — they need the UMG/AnimBP editor (not Python).

Options when this is taken on:
- **Editor session:** manually author `ABP_ARPGCharacter` once (parent
  `UARPGAnimInstance`, state machine, BS_Locomotion, layered upper-body),
  commit the `.uasset`. This makes the full combat-anim system real but is a
  one-time manual cost.
- **Pure-C++ alternative:** subclass `UARPGAnimInstance` and override
  `NativeUpdateAnimation` to *fully* drive pose updates via
  `Montage_Play` + direct sequence-blending — feasible but unconventional.

Defer this to its own sub-project; the slice doesn't need the full
state machine.

## Verification this work succeeded

- A real Mixamo-sourced attack montage plays when the player attacks;
  `GA_MeleeAttack`'s normal montage-driven path activates (the fallback
  timer is no longer the only path, verified by a log).
- The enemy moves toward the player and attacks; the player's Health
  visibly drops; the HUD's player health bar moves.
- A `BP_VSRangedEnemy` shoots — the second archetype works end-to-end.
- The PS-1 functional test still passes; a new "player takes damage"
  functional test passes.
