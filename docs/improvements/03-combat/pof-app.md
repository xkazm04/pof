# 03 · Combat — PoF App Improvements

## Goals

PoF's combat module should produce abilities that **run end-to-end on first
generation** — no fix-loop discovering that the ability never gets granted,
that its damage path is notify-gated on an empty montage, or that the GE
calculation reads attributes nobody set.

## Improvements

### 1. The combat checklist gains explicit "wiring contracts"

`src/lib/module-registry.ts` `arpg-combat` checklist items extend their
prompts with a small contract per ability (this rides on the cross-cutting
"Wiring Requirements" pattern in [[../01-generation-quality/pof-app.md]]):

- **Granted by** — `DefaultAbilities` array of which actor class? Specify
  the actor that owns it.
- **Activated by** — tag (`Ability.<Category>.<Name>`), input action, or
  AI controller call. Specify exactly.
- **Damage path** — *Animation-driven* (notify in a montage) **or**
  *Direct* (applied inside `ActivateAbility` at a deterministic offset).
  Pick one; do not depend on a montage notify in gray-box mode.
- **Required content assets** — montage, GE class, AnimNotify class.

The checklist surface gains a "Wiring complete?" column the operator can
tick off after dispatch.

### 2. A "gray-box vs. content-rich" ability mode

The single biggest pain in `GA_MeleeAttack` was the empty-montage code path.
Make this explicit in the C++ — add a `bool bUseAnimationDrivenDamage`
property (default `false`); when `false`, the ability applies its damage
spec at a deterministic offset inside `ActivateAbility` and uses the
fallback window for visual timing. When `true`, the ability relies on a
real montage + `AnimNotifyState_HitDetection` firing `Event.MeleeHit`. This
removes the ambiguity PS-1 + Characters fought through.

PoF's prompt should *generate* abilities with `bUseAnimationDrivenDamage =
false` by default; a follow-up "wire animations" pass flips it true when a
real montage is in place.

### 3. A combat-simulation prompt — "trace one hit"

Add to `src/lib/evaluator/module-eval-prompts.ts` a combat-specific Pass 4:
"For ability `X`, trace one hit end-to-end. Name the actor that activates
it, the tag/event/input, the GE applied, the attributes read and written,
the delegate(s) broadcast, the listeners. Identify any step that needs a
binary asset (montage, notify, BT) and flag it. Output a numbered call
graph."

This produces a check-able artifact + catches gaps like "the damage GE
reads `Armor` but no GE sets it" before generation.

### 4. Surface the attribute set as data

`UARPGAttributeSet` is a large class with 20+ attributes; only Health and
MaxHealth are exercised. PoF's combat module should generate a small
`DT_AttributeDefaults` DataTable seeded with sensible defaults for every
attribute (Player vs. Skeleton vs. Boss rows — the `AttributeInitRowName`
on `ARPGCharacterBase` already expects this). Until this DataTable exists,
*every* damage formula that uses anything beyond Base is a no-op.

A small PoF UI under `arpg-combat` lists the attributes + their current
default per row, lets the user edit them, and emits the DataTable via UE
Python (`unreal.AssetTools.create_asset(... DataTable, RowStruct=
FARPGAttributeInitRow)`).

### 5. A "combat feel" panel — knobs not in code

Hit-pause, camera shake intensity, screen flash on hit, knockback impulse
— combat feel polish that PS-1 / Characters did not touch but the slice
will visibly benefit from. Add a small panel under `arpg-combat` exposing
each knob, with the underlying C++ properties on `UGA_MeleeAttack` /
`AARPGPlayerCharacter` (or a new `UARPGCombatFeelSettings` UDeveloperSettings).
PoF dispatches a Python script that sets the values on `BP_VSPlayer`'s
GE/ability defaults.

### 6. Detect the parallel-Health pitfall

A vitest test or a checklist warning surfaces the latent
`AARPGPlayerCharacter::Health` (plain float) vs.
`UARPGAttributeSet::GetHealth()` (GAS) inconsistency. PoF flags it in the
combat module's evaluator: "Two Health systems exist; the HUD and damage
pipeline use GAS. Decide: deprecate the plain float, or sync it from GAS
in `PostGameplayEffectExecute`."

## Verification this work succeeded

- A new dispatch of `arpg-combat` produces a `GA_*` ability whose
  Wiring-Requirements block names the granting actor + the activation
  trigger + the damage-path mode, and whose `bUseAnimationDrivenDamage`
  defaults to false.
- The `DT_AttributeDefaults` exists and is referenced by `BP_VSPlayer` /
  `BP_VSEnemy`; the functional test sees attribute values that match the
  table.
- The combat-trace evaluator pass produces a complete call graph for
  `GA_MeleeAttack` and flags the parallel-Health inconsistency.
