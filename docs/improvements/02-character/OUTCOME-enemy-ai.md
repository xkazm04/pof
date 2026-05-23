# Outcome — Enemy AI + player-takes-damage (Character CLI deliverable #1)

**Date:** 2026-05-23 · **Status:** DONE, both functional-test gates green.
Spec: `docs/superpowers/specs/2026-05-23-character-enemy-ai-design.md`.
Plan: `docs/superpowers/plans/2026-05-23-character-enemy-ai.md`.

## What shipped (UE repo `pof-exp`, commits `3e39717` + `097cf15`)

- **`AARPGSimpleAIController`** (`Source/PoF/AI/`) — pure-C++, no Behaviour Tree.
  Chases the player with direct `AddMovementInput` steering (nav-independent —
  works on the bare arena floor), faces the player with `SetActorRotation`, and
  activates the enemy melee ability by tag on `AttackCooldown`.
- **`GA_EnemyMeleeAttack` gray-box fallback** — mirrors `GA_MeleeAttack`'s
  `bUsingFallbackWindow` pattern: with the project's empty `SwingMontage`, a
  `WaitDelay` drives `PerformFrontArcDamage()` once (guarded by `bDamageApplied`)
  so the front-arc damage still lands. `DamageEffect` now defaults to
  `UGE_Damage::StaticClass()` in C++, so the raw ability class is granted
  directly (no config-BP).
- **`AVSEnemyAttackTest`** (`Source/PoF/Test/`) — teleports the player into the
  enemy's front arc and asserts the player's GAS Health dropped.
- **`setup_enemy_ai.py`** — wires `BP_VSEnemy` (controller + `GrantedAbilities`)
  and builds the isolated `/Game/Maps/VSEnemyAttack` test map.

## Verification

- `Project.Functional Tests.Maps.VSEnemyAttack.VSEnemyAttackTest` → **Success**:
  `[GA_EnemyMelee] Hit BP_VSPlayer for 15.0 base damage`, player Health
  **100.0 → 85.0**.
- `Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest` (PS-1) →
  **Success**, all criteria (#2–#5) green. The slice enemy is now hostile too
  (it hit the player twice mid-test); the player survived and still killed it.

## Lessons / non-obvious findings (worth carrying to other CLIs)

- **Activation-tag mismatch:** `MeleeGrunt`'s `PrimaryAbilityTag` is
  `Ability.Melee.LightAttack` (the *player's* tag), but `GA_EnemyMeleeAttack`'s
  asset tag is `Ability.Enemy.Melee`. The controller activates by
  `Ability.Enemy.Melee`, not `PrimaryAbilityTag`.
- **UE Python CDO-vs-instance staleness:** setting `AIControllerClass` on the
  `BP_VSEnemy` CDO persisted to the `.uasset` (verified by read-back), but the
  enemy *placed in the same script session* baked the stale native default
  (`AARPGAIController`) into the `.umap` as an explicit instance override,
  silently beating the CDO at PIE load. Fix: set the controller class on the
  **placed instance** after spawning. (The first test run failed exactly here —
  log showed `AARPGAIController::OnPossess - No BehaviorTreeAsset set`.)
- **Shared UE tree across the 8 CLIs:** the editor module build is monolithic,
  so a build compiles every CLI's in-flight files; commit only your own files by
  exact path. A single shared `UnrealEditor` instance with Live Coding blocks
  full rebuilds of new `UCLASS`es — coordinate editor-close timing.
- **Deferred (still open from game.md):** real attack animation (Mixamo, §1),
  second archetype (§4), custom AnimBP (§6), and the PoF-app character module.
