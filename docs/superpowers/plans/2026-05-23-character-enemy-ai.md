# Enemy AI + player-takes-damage — Plan (DELIVERED) + next directions

**Status:** ✅ Delivered & verified, 2026-05-23. The task-by-task
implementation steps have been removed now that they're done; the full outcome,
commits, and lessons live in
[`docs/improvements/02-character/OUTCOME-enemy-ai.md`](../../improvements/02-character/OUTCOME-enemy-ai.md).
Spec: [`2026-05-23-character-enemy-ai-design.md`](../specs/2026-05-23-character-enemy-ai-design.md).

This doc now serves as a forward-looking roadmap: a compact record of what
shipped, plus **Proposed next development directions** for the character track.

---

## Delivered (what now exists)

**Goal met:** the vertical-slice enemy is hostile — it chases the player and
attacks, the player's GAS Health drops, and the slice still plays.

| File (UE repo `pof-exp`) | What it does |
|--------------------------|--------------|
| `Source/PoF/AI/ARPGSimpleAIController.{h,cpp}` | Pure-C++ controller (no BT). Chases via direct `AddMovementInput` (nav-independent), faces the player, activates the enemy melee by `Ability.Enemy.Melee` tag on `AttackCooldown`. |
| `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.{h,cpp}` | Gray-box fallback (mirrors `GA_MeleeAttack`'s `bUsingFallbackWindow`) so front-arc damage lands with the empty `SwingMontage`; `DamageEffect` defaults to `UGE_Damage` in C++; once-per-activation `bDamageApplied` guard. |
| `Source/PoF/Test/VSEnemyAttackTest.{h,cpp}` | Functional test: teleports the player into the enemy's front arc, asserts Health dropped. |
| `Content/Python/setup_enemy_ai.py` | Wires `BP_VSEnemy` (controller + `GrantedAbilities`), builds the isolated `/Game/Maps/VSEnemyAttack` test map. |

**Verification (both green):** `VSEnemyAttackTest` → player **100 → 85**;
PS-1 `VSFunctionalTest` → all criteria pass with the slice enemy now hostile.

**Commits:** `3e39717` (C++), `097cf15` (Python + assets), pushed to
`pof-exp` `main`.

**Key deviations from the original design (intentional, lower-risk):**
direct steering instead of `MoveToActor` (no NavMesh dependency); `DamageEffect`
defaulted in C++ instead of a config-BP; an isolated test map instead of a
second test actor in the slice map. The activation-tag question resolved to
`Ability.Enemy.Melee` (not the `MeleeGrunt` `PrimaryAbilityTag`, which is the
player's light-attack tag).

---

## Proposed next development directions

Ordered by impact-to-effort. Each builds directly on what shipped. None are
started; treat this as a backlog to brainstorm/spec individually (one
deliverable per CLI run, same workflow as this one).

### Track 1 — Make the fight *visible* (highest impact)

The combat loop works, but the enemy's attack is currently invisible: the
gray-box fallback applies damage with no swing animation, and the player shows
no hit reaction. This is the biggest gap between "the test passes" and "it
feels like a fight."

1. **Real enemy attack montage (Mixamo).** Author a swing montage on the enemy
   mannequin with a hit-window `AnimNotifyState` that fires `Event.MeleeHit`.
   `GA_EnemyMeleeAttack` *already* has the notify-driven path coded — when a
   playable montage is present, `bCanPlayMontage` is true and the fallback is
   skipped automatically, so this is drop-in once the montage asset exists.
   (Spec §1 / `game.md` §1. Note the binary-asset wall: montage authoring is
   manual or Mixamo-import, not pure-Python.)
2. **Player hit reaction + HUD damage feedback.** A player hit-react montage (or
   flinch) on taking damage, plus a HUD damage flash / shake on the player
   health bar (the HUD CLI's bar already binds GAS Health). Makes incoming
   damage legible.
3. **Attack telegraph / wind-up.** The fallback applies damage 0.3 s after
   activation with no anticipation. Add a wind-up window (pose or VFX) before
   the hit so the attack is readable and dodgeable. A real montage (item 1)
   gives this timing naturally; until then, a wind-up VFX on the gray-box path.

### Track 2 — Player survivability loop (now unblocked)

4. **Player death + respawn / game-over.** The player can now reach 0 Health —
   previously impossible, so there's no death flow. The enemy already has a
   `GA_Death` pattern to mirror. Decide: respawn at PlayerStart, or a
   game-over screen. New `AVSPlayerDeathTest` (drive the player to 0, assert the
   death flow fires).

### Track 3 — Combat breadth

5. **Second enemy archetype (ranged).** `game.md` §4. The archetype tuning
   already exists on `AARPGEnemyCharacter` (`RangedCaster`: `AttackRange` 800,
   `PreferredCombatDistance` 800, `RetreatDistance` 400). Extend
   `ARPGSimpleAIController` to honor `PreferredCombatDistance`/`RetreatDistance`
   (kite: advance if too far, retreat if too close, fire at range) and grant a
   `GA_EnemyRangedAttack`. The controller's distance logic is the only code
   change; the rest is wiring + a projectile ability.
6. **Multiple enemies + spawning + aggro.** One enemy today. The controller
   targets the player generically, so spawning N enemies "just works" for
   melee; add an encounter spawner and (optionally) simple aggro/spacing so
   they don't stack on one point.

### Track 4 — Navigation upgrade (when the arena gains geometry)

7. **NavMesh + pathfinding.** Direct steering is fine on the flat arena but
   ignores obstacles and other agents. When the environment CLI (folder 05)
   adds arena geometry, drop in a `NavMeshBoundsVolume` and switch the chase to
   `MoveToActor` (keep direct steering as the no-nav fallback). Coordinate with
   folder 05.

### Track 5 — PoF-app tooling (turn the lessons into product)

8. **Character/AI authoring surface.** `pof-app.md`: a character module +
   wizard, a known-assets registry (mannequin paths), a Mixamo import flow, and
   a "make this enemy hostile" recipe. Concretely surfaced this session: the
   generator must set `AIControllerClass` (and similar class-pointer props) on
   **placed instances**, not just the BP CDO — the CDO-vs-instance staleness bug
   silently reverted the controller to the native default. Bake that fix +
   a read-back verification step into the generation tooling.

### Track 6 — Cross-CLI test integration

9. **Reparent onto `AARPGFunctionalTestBase`.** The harness/testing CLI
   (folder 08) is landing a functional-test base class + a
   `Source/PoF/Test/<System>/` hierarchy. Once committed, reparent
   `AVSEnemyAttackTest` onto it (cuts boilerplate ~70%) and move it under
   `Test/Character/`. Pure coordination/refactor — no behavior change.

---

## Suggested sequencing

Track 1 (items 1–3) first — it's the visible payoff and item 1 is nearly
drop-in. Track 2 (item 4) pairs naturally (you want a death flow once the player
visibly takes hits). Tracks 3–4 add breadth; Tracks 5–6 are tooling/integration
that can run in parallel via their own CLIs.
