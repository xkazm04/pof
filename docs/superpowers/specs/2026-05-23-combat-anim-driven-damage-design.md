# Combat-1 · `bUseAnimationDrivenDamage` — explicit gray-box vs animation-driven damage

**Date:** 2026-05-23
**Sub-project:** `03-combat` (Combat improvements, CLI #3)
**Source brainstorm:** `docs/improvements/03-combat/{README,game,pof-app,tests}.md` (§game.md 1, §pof-app.md 1–2, §tests.md)
**Status:** Design approved — proceeding to implementation plan.

## Problem

`UGA_MeleeAttack` applies damage only inside `OnMeleeHit(FGameplayEventData)`, which
reads its victim from `Payload.Target`. That payload is supplied by a hit-detection
`AnimNotifyState` embedded in the attack montage (`AM_MeleeCombo`). The slice ships
with an **empty** montage and gray-box characters (no anim instance), so:

- The notify never fires → `Event.MeleeHit` never arrives → **in real play, pressing
  attack does not damage the enemy.**
- The only reason `AVSFunctionalTest` phase #4 passes is that the test **sends
  `Event.MeleeHit` itself** — a hack (the "PS-1 test-sends-the-event" workaround) that
  proves the GE plumbing but *not* the in-game hit path.

The fallback machinery added by PS-1 (`FallbackAttackWindow`, `bUsingFallbackWindow`)
keeps the ability — and its `Event.MeleeHit` listener — alive when the montage can't
play, but nothing in the gray-box path ever *fires* a hit. The window is a liveness
fix, not a damage path.

## Goal

Make the two damage paths **explicit and selectable** via a single property, so the
gray-box slice deals damage deterministically today, and the animation-driven path
(real montage + hit notify) is a one-flag flip once `02-character` lands a montage.

## Design

### New properties on `UGA_MeleeAttack`

| Property | Default | Purpose |
|----------|---------|---------|
| `bool bUseAnimationDrivenDamage` | `false` | The mode switch. `false` = ability self-applies damage; `true` = rely on the montage's hit notify firing `Event.MeleeHit`. |
| `float GrayBoxHitDelay` | `0.2f` | In `false` mode, how far into the swing the self-applied hit lands (a small wind-up so it reads as an attack and matches where a real notify would fire). |
| `float MeleeHitRange` | `180.f` | Forward melee reach (cm) for the gray-box target search. Deliberately distinct from the 400 cm warp/magnetism radius — magnetism is a long lunge, a *hit* is short. |

### Two refactors (no behavior change to existing paths)

1. **`AActor* FindForwardTarget(float Range, float HalfAngleDeg) const`** — extract the
   overlap-sphere + forward-cone + alive-check (`State.Dead`) + nearest-combatant logic
   currently inlined in `AcquireWarpTarget()`. `AcquireWarpTarget` calls it with
   `WarpTargetSearchRadius` / `WarpTargetSearchAngle` and is otherwise unchanged.
2. **`void ApplyMeleeDamageTo(AActor* Target, const FHitResult* OptionalHit)`** — extract
   the GE-build-and-apply body of `OnMeleeHit` (make effect context, add hit result,
   `MakeOutgoingSpec`, set `Data.Damage.Base` SetByCaller with the combo multiplier, add
   `Damage.Physical`, apply to target ASC). `OnMeleeHit` becomes: resolve `Payload.Target`
   + optional hit result, then call `ApplyMeleeDamageTo`.

### Behavior

- **`bUseAnimationDrivenDamage == false` (default — gray-box):** in
  `StartMontageAndListenForCombo`, immediately after `ListenForComboWindow()` and
  **before** the montage/fallback branching (the montage-playing branch `return`s early,
  so the schedule must precede it), schedule a `UAbilityTask_WaitDelay(GrayBoxHitDelay)`.
  On finish: `FindForwardTarget(MeleeHitRange, WarpTargetSearchAngle)` → if non-null,
  `ApplyMeleeDamageTo(target, nullptr)`. This fires whether or not a montage played; the
  hit is deterministic and needs no notify. The `Event.MeleeHit` listener stays wired
  (so an external send still works) but is no longer required for damage.
- **`bUseAnimationDrivenDamage == true` (real montage with a hit notify):** skip the
  self-apply entirely; rely on the notify firing `Event.MeleeHit` → `OnMeleeHit`
  → `ApplyMeleeDamageTo`. This is today's behavior. Flipping the flag is the
  "animation actually landed" follow-up, gated on `02-character` shipping `AM_MeleeCombo`
  with a hit-detection notify.

The self-apply uses the *current* `CurrentComboIndex` for its combo multiplier, exactly
as `OnMeleeHit` does, so combo scaling is preserved across both paths.

### Functional-test integration (retiring the hack)

`AVSFunctionalTest` phase #4 currently *sends* `Event.MeleeHit` manually. With `false`
mode self-applying, that would double-hit. Combat-1 updates phase #4 to:

- Position **and orient** the player within `MeleeHitRange` of the enemy and facing it
  (the forward cone misses otherwise — this is the real risk; see below).
- Activate `GA_MeleeAttack` and **stop sending `Event.MeleeHit`**.
- Assert the enemy's `Health` dropped after `GrayBoxHitDelay` elapses.

This retires the test-sends-the-event hack — the whole point. Phase #5's lethal-damage
drive to death + loot is unchanged.

### PoF app side

Update the `arpg-combat` checklist prompt default in `src/lib/module-registry.ts` so the
generated `GA_MeleeAttack` carries `bUseAnimationDrivenDamage = false` and the
self-apply gray-box path by default — i.e. PoF generates abilities that deal damage in a
gray-box project out of the box, with a documented one-flag path to animation-driven
damage. No app-runtime change; this is a generated-prompt-default change only.

## New tests

- **`AVSCombatGrayBoxPathTest`** — set `bUseAnimationDrivenDamage = false` (the default),
  place a live enemy within `MeleeHitRange` in front of the player, activate the ability,
  and assert the enemy's `Health` dropped **without any `Event.MeleeHit` send**. This is
  the regression guard for the in-game hit path.
- **`AVSCombatAbilityGrantTest`** — assert the player ASC has each `DefaultAbilities`
  entry granted (a discoverable spec per ability class). Forward-looks to sub-project (2)
  but belongs to combat coverage.

Both follow the existing `AFunctionalTest` four-phase Tick pattern (and will reparent to
`AARPGFunctionalTestBase` if/when `08-harness-testing` lands it — not a dependency here).

## Files touched

**UE project repo** (`…/Unreal Projects/PoF`, pushes to `github.com/xkazm04/pof-exp`):
- `Source/PoF/AbilitySystem/GA_MeleeAttack.h` — 3 new UPROPERTYs + 2 method decls.
- `Source/PoF/AbilitySystem/GA_MeleeAttack.cpp` — refactors + the `false`-mode WaitDelay
  self-apply branch.
- `Source/PoF/Test/VSFunctionalTest.cpp` — phase #4 update (orient + drop the event send).
- `Source/PoF/Test/AVSCombatGrayBoxPathTest.{h,cpp}` (or `Combat/` subfolder) — new.
- `Source/PoF/Test/AVSCombatAbilityGrantTest.{h,cpp}` — new.

**PoF app repo** (`C:\Users\kazda\kiro\pof`, commit locally only — do **not** push):
- `src/lib/module-registry.ts` — `arpg-combat` prompt default.
- This spec.

## Risks / open verification gates

1. **Forward-cone orientation.** `FindForwardTarget` requires the enemy to be within
   `MeleeHitRange` *and inside the forward cone*. The functional-test phase #4 must
   actively orient the player toward the enemy before the attack, or the search returns
   null and damage never applies. The re-run of `VSFunctionalTest` is the gate.
2. **Double-hit avoidance.** Once #4 drops the manual event send, confirm damage is
   applied exactly once (no stray notify, no leftover send). The `Health` delta should
   equal `BaseDamage × ComboMultiplier[0]`, not twice that.
3. **`MeleeHitRange` vs spawn geometry.** 180 cm is a guess; if the slice's enemy spawns
   further than that from melee range, either the test repositions or the default rises.
   Decide against the actual `VerticalSlice` layout during implementation.

## Out of scope (deferred)

- The actual `AM_MeleeCombo` montage + hit-detection notify (owned by `02-character`).
- Flipping `bUseAnimationDrivenDamage = true` for the shipped slice (follows the montage).
- Damage-formula DataTable work (`game.md` §4) and hit-pause / camera-shake (`game.md` §6).
- The ability-roster grant + input binding — that is **sub-project (2)**, queued next.
