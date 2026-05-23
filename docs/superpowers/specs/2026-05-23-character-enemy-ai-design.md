---
date: 2026-05-23
status: draft
sub_project: Character CLI #2 — enemy AI + player-takes-damage
parent: docs/improvements/02-character/ (game.md §2 + §3)
---

# Enemy AI + player-takes-damage

## Context

This is the first deliverable of the "character" improvement CLI (one of eight
isolated CLIs forked from the vertical-slice initiative). The slice currently
has the player attacking a **passive** enemy — `AARPGEnemyCharacter` has full
Behaviour-Tree AI scaffolding but no BT asset assigned, so the enemy stands
still, never attacks, and the player never takes damage (the HUD's player bar
sits at full). See `docs/improvements/02-character/game.md` §2 + §3.

This deliverable makes the enemy hostile (a pure-C++ AI controller — no BT-asset
wall) and makes the player take damage from it, turning "attack a passive
dummy" into "fight a hostile enemy."

## Established facts (on-disk, verified 2026-05-23)

- `AARPGEnemyCharacter` (`Source/PoF/Character/ARPGEnemyCharacter.h`):
  `GrantedAbilities` (`TArray<TSubclassOf<UGameplayAbility>>`, granted in
  `GrantAbilitiesToASC()` on possession), `AttackRange` (default 200),
  `AttackCooldown` (2.0), `PrimaryAbilityTag` (`FGameplayTag` to activate the
  attack), `PreferredCombatDistance`, `RetreatDistance`, `Archetype`,
  `OnEnemyDeath`, `bIsAlive`/`IsAlive()`/`IsDead()`.
- `UGA_EnemyMeleeAttack` (`Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h`):
  plays `SwingMontage`; at the hit window (anim notify → `Event.MeleeHit` →
  `OnMeleeHitEvent`) runs `PerformFrontArcDamage()` — a front-arc sphere
  overlap (`HitRadius` 200, `HitHalfAngle` 90) applying `DamageEffect`
  (`GE_Damage`, `BaseDamage` 15) to overlapped pawns. **No specific target —
  it sweeps an arc.**
- `AM_MeleeCombo` / the project's montages are empty shells — so the enemy's
  notify never fires `Event.MeleeHit`, and `PerformFrontArcDamage()` never
  runs (the same empty-montage gap the player's `GA_MeleeAttack` had).
- The player ability `GA_MeleeAttack` was given a gray-box fallback in PS-1 +
  the Characters sub-project (`bUsingFallbackWindow`, pre-armed before
  `ReadyForActivation` to dodge a synchronous `OnInterrupted` `EndAbility`
  race). `GA_EnemyMeleeAttack` needs the same treatment.
- `ARPGCharacterBase::DefaultAbilities` (PS-1) is granted on possession;
  `AARPGEnemyCharacter` additionally grants `GrantedAbilities` in
  `GrantAbilitiesToASC()`.
- `Source/PoF/AI/` has `ARPGAIController` (BT-based — needs a BT asset, the
  wall) + all BT tasks/services/decorators. The new controller is a separate
  pure-C++ class, not a change to `ARPGAIController`.
- The slice enemy is `/Game/VerticalSlice/BP_VSEnemy` (parent
  `AARPGEnemyCharacter`, `SKM_Manny_Simple` + `M_EnemyRed`, from the prior
  character work). Player is `/Game/VerticalSlice/BP_VSPlayer`. The HUD
  (`UVSHUDWidget`) already binds the player's GAS Health.
- The PS-1 in-engine test is `Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`
  (`Source/PoF/Test/VSFunctionalTest.cpp`).

## Goals

1. The enemy chases the player and attacks when in range — pure C++, no BT asset.
2. The enemy's melee actually damages the player (the empty-montage gap closed
   with a gray-box fallback in `GA_EnemyMeleeAttack`).
3. The player's GAS Health drops on being hit; the HUD player bar moves.
4. The slice still plays — the PS-1 functional test holds with the enemy now
   active.

## Non-goals

- **No real attack animation** (Mixamo) — the enemy swing has no visible
  animation; the gray-box fallback applies the damage. Deferred (game.md §1).
- **No second enemy archetype** (game.md §4), no custom AnimBP (§6).
- **No PoF-app changes** — this deliverable is entirely UE-project-side.
- **No Behaviour Tree** — the pure-C++ controller sidesteps the BT-asset wall.
- **No full player-death UX** — the player takes damage and the bar moves;
  elaborate death/respawn handling is out of scope (the player should survive
  the verification window).

## Decision record (from brainstorming)

1. **Scope = enemy AI + player-takes-damage** (chosen over attack-animation
   first and over a game+PoF-paired deliverable).
2. **A1 — ability-level gray-box fallback** in `GA_EnemyMeleeAttack` (chosen
   over A2, the controller applying damage directly). Consistent with the
   player ability; damage flows through GAS; the montage path resumes when a
   real swing animation lands.

## Design

### 1. `AARPGSimpleAIController : AAIController` (new)

`Source/PoF/AI/ARPGSimpleAIController.{h,cpp}`. A minimal, pure-C++ controller.

- `OnPossess(APawn*)` — cache the controlled `AARPGEnemyCharacter*` + its ASC;
  enable `Tick`.
- `Tick(float Dt)`:
  - Resolve the player pawn (`UGameplayStatics::GetPlayerPawn(this, 0)`); if
    null, or the enemy is dead (`enemy->IsDead()`), or the player is dead, do
    nothing.
  - `Dist = distance(enemy, player)`.
  - If `Dist > enemy->GetAttackRange()` → `MoveToActor(player,
    /*acceptance*/ enemy->GetAttackRange() * 0.9f)`.
  - Else (in range): stop moving; face the player (set focal point /
    `SetControlRotation` toward the player); if `TimeSinceLastAttack >=
    enemy->GetAttackCooldown()` → `ASC->TryActivateAbilitiesByTag(
    FGameplayTagContainer(enemy->GetPrimaryAbilityTag()))` and reset the
    cooldown timer.
  - Track `TimeSinceLastAttack` as a member accumulated each tick (or a
    timestamp).
- No BT, no blackboard. Self-contained.

`BP_VSEnemy` sets `AIControllerClass = AARPGSimpleAIController` (per-BP, via
Python — not a change to `AARPGEnemyCharacter`'s default, so other enemies/the
BT path are untouched) and `AutoPossessAI = PlacedInWorldOrSpawned` (so the
placed slice enemy actually gets a controller).

### 2. `GA_EnemyMeleeAttack` gray-box fallback

Mirror the player `GA_MeleeAttack` pattern (read `GA_MeleeAttack.cpp` at plan
time for the exact `bUsingFallbackWindow` ordering — it is pre-armed *before*
`ReadyForActivation()` to avoid a synchronous `OnInterrupted` → `EndAbility`
race when the empty montage cancels):

- In `ActivateAbility`: set up the `WaitGameplayEvent(Event.MeleeHit)` listener
  first; pre-check whether `SwingMontage` is playable on this avatar (has a
  skeletal mesh + a non-empty montage). If not playable → set the fallback
  flag, start a `WaitDelay` (~`0.3 s` swing-window offset), and on its
  completion call `PerformFrontArcDamage()` directly (the work the notify
  would have triggered), then `EndAbility`. If the montage *is* playable, the
  existing notify-driven path runs unchanged.
- The montage-cancel callbacks (`OnMontageInterrupted`/`OnMontageCompleted`)
  must early-return when the fallback flag is set (the same guard the player
  ability uses) so they don't `EndAbility` before the fallback fires, and
  `PerformFrontArcDamage()` must be guarded to apply at most once per
  activation (no double-application).

### 3. `BP_GA_EnemyMeleeAttack` + `BP_VSEnemy` wiring (UE Python)

A UE Python script (`Content/Python/setup_enemy_ai.py`):

- Create `/Game/VerticalSlice/BP_GA_EnemyMeleeAttack` (parent
  `UGA_EnemyMeleeAttack`) with `DamageEffect = GE_Damage`, `SwingMontage =
  AM_MeleeCombo` (the shell — the fallback handles it), `BaseDamage` left at a
  value the player survives the test window (≤ 15).
- On `BP_VSEnemy`'s CDO: set `AIControllerClass = AARPGSimpleAIController`,
  `AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned`, append
  `BP_GA_EnemyMeleeAttack` to `GrantedAbilities`, and set `PrimaryAbilityTag`
  to the tag `UGA_EnemyMeleeAttack`'s ctor assigns (confirm at plan time, e.g.
  `Ability.Enemy.Melee`).
- Save the assets. (Run headless via the full-editor `-ExecutePythonScript`
  form — `-run=pythonscript` may crash on asset ops per prior sub-projects.)

### 4. Verification

- **New `AVSEnemyAttackTest`** (`Source/PoF/Test/`, an `AFunctionalTest`):
  place the player within the enemy's `AttackRange`; possess both; tick for
  ~3 s; assert the player's GAS `Health` is `< MaxHealth` (it took damage).
  Run headless via `Automation RunTests`.
- **Re-run the PS-1 `AVSFunctionalTest`** — it must still report #2–#5 green
  with the enemy now active. If the active/moving enemy disturbs the test's
  positional assumptions or kills the player mid-test, tune the enemy's
  `BaseDamage` / `AttackCooldown` or the test's setup (the enemy is hostile
  but the test still drives the player to kill it via a lethal `GE_Damage`).

## Cross-cutting

- **Repo:** all changes are UE-project-side → committed to the UE repo
  (`github.com/xkazm04/pof-exp`). This (the spec/plan/findings) commits to the
  PoF app repo.
- New C++ (`ARPGSimpleAIController`, the `GA_EnemyMeleeAttack` edit, the test)
  → a `PoFEditor` rebuild. `AIModule` is needed for `AAIController` /
  `MoveToActor` — confirm `AIModule` is in `PoF.Build.cs` (the existing
  `ARPGAIController` implies it is; verify at plan time).
- Controller-driven (the implementing session writes the C++ + Python, builds,
  runs).

## Definition of done

1. `AARPGSimpleAIController` created; `GA_EnemyMeleeAttack` has the gray-box
   fallback; editor target builds clean.
2. `setup_enemy_ai.py` run; `BP_GA_EnemyMeleeAttack` exists; `BP_VSEnemy` uses
   the simple controller + auto-possess + the granted attack ability.
3. `AVSEnemyAttackTest` passes (player Health drops).
4. The PS-1 `AVSFunctionalTest` re-runs green (#2–#5) with the enemy active.
5. A real-launch Gemini screenshot (optional, confirmatory) shows the enemy
   moving toward / engaging the player.
6. UE changes committed to `pof-exp`; spec/plan/findings to the app repo.

**Success criterion:** in the slice, the enemy chases and attacks the player;
the player's HUD health bar visibly drops; the player can still defeat the
enemy; gameplay (PS-1 criteria) remains intact.

## Risks & mitigations

- **`GA_EnemyMeleeAttack` double-applies damage** if the fallback + a (rare)
  montage callback both fire. Mitigation: a once-per-activation guard on
  `PerformFrontArcDamage`, mirroring the player ability's care.
- **Active enemy disturbs the PS-1 test.** Mitigation: re-run it as a hard
  gate; tune `BaseDamage`/`AttackCooldown`/placement so the player survives
  and the existing assertions hold.
- **`AutoPossessAI` not set / wrong** → no controller → no AI. Mitigation:
  set it explicitly on `BP_VSEnemy`; the `AVSEnemyAttackTest` fails loudly if
  the enemy never attacks.
- **`MoveToActor` needs a NavMesh.** The slice arena floor needs a
  `NavMeshBoundsVolume` for pathfinding; if absent, the enemy can't path.
  Mitigation: the Python wiring adds a `NavMeshBoundsVolume` + `RecastNavMesh`
  covering the arena if not present; verify the enemy actually closes distance
  in the test.
- **`AIModule` missing from `PoF.Build.cs`.** Mitigation: confirm at plan
  time; add if needed (the build catches it).

## Next steps

1. Spec self-review (inline).
2. User reviews this spec.
3. `writing-plans` → implementation plan.
4. Execute: C++ (controller + ability fallback) → Python wiring → tests.
