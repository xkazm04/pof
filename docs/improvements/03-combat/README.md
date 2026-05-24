# 03 · Combat

## Scope

Gameplay abilities (`Source/PoF/AbilitySystem/GA_*`), damage execution,
GameplayEffects, hit detection, montage-driven combat, and "combat feel"
polish (hit pause, camera shake, screen flash). The on-field side of "the
attack works."

## Current state

The vertical slice's combat chain works end-to-end — `GA_MeleeAttack`
activates by tag, `GE_Damage` applies through `UARPGDamageExecution`, the
enemy's `Health` depletes, `GA_Death` fires via `Event.Death`,
`OnDeathFromAbility` broadcasts `OnEnemyDeath`, the loot component drops a
gold `ARPGWorldItem`. But:

- **Damage application path is gameplay-event-gated** on `Event.MeleeHit`
  — which a real AnimNotifyState in `AM_MeleeCombo` would fire, but the
  montage is empty so it never does. PS-1 worked around this by sending
  the event from `VSFunctionalTest`. `GA_MeleeAttack` has a *timer
  fallback window* PS-1 added for no-mesh characters; the Characters
  sub-project further pre-armed `bUsingFallbackWindow` before
  `ReadyForActivation` to handle the synchronous-`OnInterrupted` race the
  mannequin's live AnimInstance introduced.
- **The combo-window infrastructure** (`AnimNotifyState_ComboWindow`,
  `AnimNotify_ComboWindow`, `GA_MeleeAttack::ComboSectionNames`) is in
  place but exercises nothing — there is no real montage with sections.
- **Many other abilities exist** but are not granted, not bound, and have
  the same empty-montage problem: `GA_Dodge`, `GA_DashStrike`,
  `GA_Fireball`, `GA_ArcaneBeam`, `GA_GroundSlam`, `GA_WarCry`,
  `GA_HitReact`, `GA_UsePotion`.
- **`UARPGAttributeSet`** has the full RPG attribute set (Health, Mana,
  Strength, Dex, Int, Armor, AttackPower, CriticalChance/Damage,
  resistances, XP) — but only `Health` and `MaxHealth` are exercised.
  Damage uses the GE without consulting Armor or resistances.
- **The player has two parallel Health systems** — the plain-float
  `Health`/`MaxHealth` on `AARPGPlayerCharacter` and the GAS attribute on
  `UARPGAttributeSet`. The HUD reads GAS; `GA_MeleeAttack` damages GAS;
  the float ones are never updated from GAS — a latent inconsistency.
- **`GA_Death`** plays a `DeathMontage` (empty shell), broadcasts
  `OnEnemyDeath`, then `SetLifeSpan(EnemyDestroyDelay)`. Death visibly
  ends with the enemy disappearing on a timer — no ragdoll, no fade-out.

## Key lessons

1. **Empty montages change the GAS path.** PS-1 and the Characters
   sub-project both surfaced different bugs in `GA_MeleeAttack` purely
   from how an empty/missing montage interacts with a no-mesh vs.
   live-AnimInstance pawn. The `bCanPlayMontage`/`bUsingFallbackWindow`
   protocol is delicate — its tests must cover both pawn shapes.
2. **`Event.MeleeHit` should not require an animation notify in
   gray-box mode.** PS-1's solution (the test sends the event) is fragile;
   the fallback window is a band-aid. A clean design: the ability runs
   the damage check at a deterministic offset inside `ActivateAbility`
   when no usable montage exists, and only routes through the notify when
   one does.
3. **The empty `AM_*` shells lie consistently.** Combat, dodge, hit-react,
   death — every montage the project references is empty. Real animations
   change every one of those code paths.
4. **The damage GE is gameplay-data-thin.** `UARPGDamageExecution` exists
   but its actual calculation likely just reads `Base` — resistances /
   armor are computed but unused. Future combat balance needs the full
   formula wired.

## Isolated-CLI session focus

A session assigned this concern works on:
- **UE project:** `Source/PoF/AbilitySystem/`, `Source/PoF/Animation/`
  (the AnimNotify*/AnimNotifyState* classes), `Content/Characters/Player/
  Animations/Montages/` (the empty shells), and the combat sections of
  the C++ test harness.
- **PoF app:** `src/components/modules/core-engine/arpg-combat/`,
  `src/lib/module-registry.ts` (the `arpg-combat` checklist), the combat
  evaluator prompts in `src/lib/evaluator/`.

It does *not* touch character mesh/AI (folder 02), HUD/UMG (folder 04),
environment (folder 05), or packaging (folder 07).

## Status (2026-05-24)

The "nothing shipped" framing is **stale** — a prior session and parallel CLIs
already landed a meaningful chunk. Reconciled state after the
`combat-pending-resolution` work
(see `docs/superpowers/plans/2026-05-24-combat-pending-resolution.md`):

- **Already done (before this work):** `UGA_MeleeAttack::bUseAnimationDrivenDamage`
  (game §1); the full `UARPGDamageExecution` formula — base+AP, crit, armor DR,
  elemental resist (game §4); the `FARPGAttributeInitRow` struct; the `acb-1`
  gray-box prompt (app §2); UE `VSCombatGrayBoxPathTest` + `VSCombatAbilityGrantTest`;
  and `EnableRagdoll()` was already invoked from `GA_Death` (most of game §7).
- **Done by this work — PoF app (branch `combat-03-improvements`):** per-ability
  wiring contracts on the `arpg-combat` checklist (§1); a combat-trace "trace one
  hit" evaluator pass guarded to `arpg-combat` (§3); a `DT_AttributeDefaults`
  editor + UE-Python emitter subtab (§4); a "Export to UE" combat-feel emitter on
  the FeedbackTab (§5); the parallel-Health flag in the combat evaluator (§6);
  plus app vitests + a `combat-loop` e2e and a (skipped) `DT_AttributeDefaults`
  presence test.
- **Done by this work — UE C++ (shared `main`, committed; needs an editor-closed
  rebuild to compile/run):** GAS-backed player Health getters + float mirror
  (game §5); hit-pause + camera-shake feel knobs on `UGA_MeleeAttack` (game §6);
  corpse fade-out on enemy death (the remaining half of §7); and the
  `VSCombatDamageFormulaTest` / `VSCombatTwoHealthSystemsTest` /
  `VSCombatAnimationDrivenPathTest` (disabled) functional tests.
- **Still pending (hard-blocked / deferred):** real montages (game §2) and the
  `BP_VSPlayer` side of granting the other abilities (game §3) — binary
  asset/Blueprint authoring; the Gemini "hit feel" e2e (tests e2e §2).
