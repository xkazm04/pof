---
date: 2026-05-24
status: draft
sub_project: Combat — resolve pending points (improvements folder 03)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/03-combat/README.md
  - docs/improvements/03-combat/pof-app.md
  - docs/improvements/03-combat/game.md
  - docs/improvements/03-combat/tests.md
  - docs/superpowers/specs/2026-05-23-combat-anim-driven-damage-design.md
---

# Combat — Resolve Pending Points (folder 03)

## Context

Folder 03's docs describe the combat improvements as "nothing shipped — plan
against a flawed baseline." That baseline is **stale**: a prior session (the
`combat-anim-driven-damage` spec) and parallel CLIs already landed a meaningful
chunk in the shared UE tree. This piece resolves the *genuinely pending* points,
split by repo and risk tier.

### What exists (verified 2026-05-24)

UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`, repo `xkazm04/pof-exp`, branch `main`):

- **game §1 DONE** — `UGA_MeleeAttack::bUseAnimationDrivenDamage`
  (`Source/PoF/AbilitySystem/GA_MeleeAttack.h:75`, default `false`) with the
  exact gray-box-vs-notify semantics the doc asked for.
- **game §4 DONE** — `UARPGDamageExecution::Execute_Implementation`
  (`Source/PoF/AbilitySystem/Effects/ARPGDamageExecution.cpp`) already computes
  `RawDamage = Base + AttackPower*Scaling`, crit roll, armor DR
  (`Armor/(Armor+100)`), and tag-gated elemental resistance — a real formula,
  not just `Base`.
- **Struct exists** — `FARPGAttributeInitRow` (`ARPGAttributeInitData.h`) and
  `ARPGCharacterBase::AttributeInitRowName` + `InitializeAttributes()` reading an
  `AttributeInitTable`. No `DT_AttributeDefaults.uasset` exists yet
  (`Content/Data/` is empty).
- **Abilities exist** — `GA_Dodge/DashStrike/Fireball/ArcaneBeam/GroundSlam/
  WarCry/HitReact/UsePotion` all present as C++ classes; `DefaultAbilities`
  (`ARPGCharacterBase.h`) granted in `PossessedBy`; `IA_AbilitySlot1..4` exist on
  `AARPGPlayerController`. Actual grant list lives in `BP_VSPlayer` (binary BP).
- **Notify classes exist** — `AnimNotifyState_HitDetection/ComboWindow`,
  `AnimNotify_ComboWindow/CameraShake` under `Source/PoF/Animation/`.
- **Two Health systems** — `AARPGPlayerCharacter` has plain-float
  `Health/MaxHealth` + `GetHealth()/GetMaxHealth()/GetHealthPercent()` reading the
  float (not GAS); GAS `Health` lives on `UARPGAttributeSet`. `TakeDamageAmount`/
  `Heal` drive the float; `PostGameplayEffectExecute` lives on the AttributeSet.
- **Ragdoll** — `AARPGCharacterBase::EnableRagdoll()` exists; not confirmed wired
  into the enemy death path. No `SetGlobalTimeDilation` (hit-pause) anywhere.
- **UE tests exist** — `VSCombatGrayBoxPathTest`, `VSCombatAbilityGrantTest`,
  `VSCombatHotbarTest`, `VSFunctionalTest` (sends `Event.MeleeHit` in phase 2).

PoF app (`C:\Users\kazda\kiro\pof`, repo branch `master`):

- **app §2 DONE** — `arpg-combat` `acb-1` prompt already specifies
  `bUseAnimationDrivenDamage = false` default + the gray-box path.
- **app §5 PARTIAL** — `CombatActionMap/polish/FeedbackTab.tsx` is a tuner UI
  (hitstop/shake/particles/sound sliders) but **emits nothing**.
- `formatWiringRequirements` (`src/lib/knowledge/wiring-requirements.ts`) exists;
  combat checklist items reference the generic pattern but carry no formal
  per-ability `Granted by / Activated by / Damage path / Required assets` block.
- `module-eval-prompts.ts` `arpg-combat` has passes ground-truth → structure →
  quality → performance; no combat "trace one hit" pass.

## Goals

Resolve the pending folder-03 points across two repos:

- **PoF app (Phase A)** — wiring contracts (§1), combat-trace pass (§3),
  `DT_AttributeDefaults` editor + Python emitter (§4), combat-feel emit (§5),
  parallel-Health detector (§6); plus the 3 app vitests + a `combat-loop` e2e.
- **UE pure-C++ (Phase C)** — resolve double-Health (§5), hit-pause + camera
  shake (§6), ragdoll death (§7); plus `AVSCombatDamageFormulaTest`,
  `AVSCombatTwoHealthSystemsTest`, and a disabled `AVSCombatAnimationDrivenPathTest`.

## Non-goals (hard-blocked / already done)

- **game §1, §4** and the GrayBox/AbilityGrant UE tests — already landed.
- **game §2 real montages** and the `BP_VSPlayer` side of **§3** (grant the 6
  GAs) — binary asset / Blueprint authoring needs the editor. Leave clear TODO
  hooks; do not fabricate assets.
- **Gemini "hit feel" e2e** (tests.md e2e §2) — deferred (needs a live build).
- **No real-luminance / render-dependent checks.**

## Workspace & repo conventions

- **App work** lands in the isolated worktree on branch
  `combat-03-improvements`; merged to `master` later by the user.
- **UE work** edits the *shared* `main` tree in place: commit **only my own
  files by exact path**, never `git add -A`, **never switch branches**. Build +
  functional-test verification needs the user to close the shared editor (new
  `UCLASS`es + Live Coding block full rebuilds) — UE C++ lands
  committed-but-unverified pending that handoff.

## Phase A — PoF app design

### A1. Wiring contracts (app §1)

Extend each `arpg-combat` checklist item prompt in `module-registry.ts` with a
compact per-ability contract using the existing wiring vocabulary:
**Granted by** (the actor whose `DefaultAbilities` holds it) / **Activated by**
(tag `Ability.<Cat>.<Name>`, input action, or AI call) / **Damage path**
(*Direct* gray-box default, or *Animation-driven*) / **Required content assets**
(montage, GE class, AnimNotify class — flag binary deps). Reuse the shape of
`formatWiringRequirements` rather than inventing new phrasing.

A "Wiring complete?" per-item toggle on the checklist surface is **deferred** if
it forces a broad change to the shared checklist component (approved); the prompt
contract is the high-value deliverable.

### A2. Combat-trace Pass 4 (app §3)

Add a combat-specific evaluator pass. `module-eval-prompts.ts` exposes per-module
context with `structureChecks/qualityChecks/performanceChecks`; add an optional
module field (e.g. `tracePass`) consumed only by `arpg-combat`, carrying the
doc's prompt: "For ability X, trace one hit end-to-end — name the activating
actor, the tag/event/input, the GE, attributes read/written, delegates broadcast,
listeners; flag any step needing a binary asset; output a numbered call graph."
The pass surface in `EVAL_PASSES`/`getPassDescription` gains the combat-trace
entry guarded so non-combat modules skip it.

### A3. DT_AttributeDefaults editor + Python emitter (app §4)

New panel under `arpg-combat` (a `CombatActionMap` subtab or sibling) listing the
`FARPGAttributeInitRow` fields with Player / Skeleton / Boss rows, editable, with
sensible defaults. An emitter (`attribute-defaults-export.ts`, mirroring
`CombatChoreographyEditor/ue5-export.ts`) produces a UE Python script that
`unreal.AssetToolsHelpers.get_asset_tools().create_asset("DT_AttributeDefaults",
"/Game/Data", DataTable, RowStruct=FARPGAttributeInitRow)` and populates the rows
(respecting the `b`-prefix-drop gotcha for any bool props). UI shows / copies the
script; dispatch is optional.

### A4. Combat-feel emit (app §5)

Add `combat-feel-export.ts` + an "Export to UE" affordance on `FeedbackTab` that
emits a Python script setting the tuner values (hitstop ms, shake scale, …) onto
the **C2** combat-feel C++ properties of `UGA_MeleeAttack` CDO / `BP_VSPlayer`.
The emitted property names match C2 exactly.

### A5. Parallel-Health detector (app §6)

Add the "two Health systems exist — HUD + damage use GAS; decide: deprecate the
float or sync in `PostGameplayEffectExecute`" flag to the `arpg-combat` evaluator
(a `qualityChecks` addition or dedicated note), plus a vitest asserting the flag
text is present in the combat eval prompt.

### A6. App tests + e2e (tests.md app §1–3, e2e §1)

- `combat-prompts.test.ts` — snapshot the `acb-1` prompt; assert
  `bUseAnimationDrivenDamage`/`false`/gray-box wording + the A1 wiring block.
- `combat-trace.test.ts` — snapshot the A2 Pass-4 prompt for `arpg-combat`;
  assert it names attribute reads/writes + binary-dep flagging.
- `dt-attribute-defaults.test.ts` — assert `DT_AttributeDefaults.uasset` exists
  under the UE project's `Content/Data/`; **skipped-with-reason** until the asset
  lands (per the doc — it points at the gap), reading via a small path helper.
- `e2e/combat-loop.spec.ts` — open Core Engine → Combat, dispatch one ability
  checklist item, assert the dispatched prompt is wired-and-runnable (contains
  the A1 contract). The "run through UE tests" leg is out of CI scope; the
  app-observable wired-prompt assertion is the exit criterion.

## Phase C — UE pure-C++ design

### C1. Resolve double-Health (game §5)

GAS is the source of truth. Make `AARPGPlayerCharacter::GetHealth()/
GetMaxHealth()/GetHealthPercent()` read GAS via the ASC
(`GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute())`), guarding the ASC
nullptr case (fall back to the float pre-possession). Keep the plain float synced
from GAS so the legacy `TakeDamageAmount`/`Heal`/`OnHealthChanged` path does not
regress — sync via the player's own GAS-change binding (or a thin
`PostGameplayEffectExecute` if the player owns the AttributeSet). Document the
decision inline. After this, the float == GAS by construction (the C4 test
asserts equality).

### C2. Hit-pause + camera shake (game §6)

Add `EditDefaultsOnly` knobs to `UGA_MeleeAttack`: `HitStopDuration` (~0.08s),
`HitStopTimeDilation` (~0.1), `TSubclassOf<UCameraShakeBase> HitCameraShake`,
`HitCameraShakeScale`. In the damage-apply path (both the gray-box self-apply and
`OnMeleeHit`), on a confirmed hit: `SetGlobalTimeDilation(0.1)` then a timer
restores `1.0` after the (real-time) duration; fire the camera shake on the
instigator's player camera (reuse `AnimNotify_CameraShake`'s play logic, or
`PlayerController->ClientStartCameraShake`). Guarded so headless/no-controller
runs don't crash. These names are exactly what A4 emits.

### C3. Ragdoll death (game §7)

Call the existing `AARPGCharacterBase::EnableRagdoll()` from the enemy death path
(`OnDeathFromAbility`, before `SetLifeSpan`). Add a best-effort fade-out: a
`UMaterialInstanceDynamic` opacity ramp over the lifespan, **guarded** for
gray-box opaque materials (skip cleanly if the material has no opacity param).

### C4. UE tests (tests.md UE §2, §3, §5)

- `AVSCombatDamageFormulaTest` — invoke the damage execution with
  `AttackPower=10`, `Armor=4`, known base; assert `FinalDamage` matches the C++
  formula (account for the actual `Armor/(Armor+100)` DR, not the doc's
  simplified `base+10-4`). Pure C++; no binary assets.
- `AVSCombatTwoHealthSystemsTest` — assert
  `AARPGPlayerCharacter::GetHealth()` == `ASC->GetNumericAttribute(GetHealth…)`
  after C1. (If C1 cannot be verified pre-handoff, the test still compiles and
  asserts the post-C1 invariant.)
- `AVSCombatAnimationDrivenPathTest` — added **disabled** with a clear reason
  (gated on a real `AM_MeleeCombo` with a hit notify).

## Verification

- App: `npm run validate` (typecheck + lint + test) green in the worktree;
  new vitests pass; `combat-loop` e2e asserts a wired prompt; `dt-attribute-
  defaults` test skips with its gap reason.
- UE: C++ compiles and the three functional tests behave as specified **after**
  the user closes the shared editor for a full rebuild (committed-but-unverified
  until then, by agreement).
- The stale "nothing shipped" baseline is corrected in this spec's "What exists."

## Risks

- **Shared UE tree** — foreign untracked WIP and a monolithic editor build mean
  my UE build can fail for reasons outside this work; report, don't fix theirs.
- **C1 regression surface** — the player's float damage path has live consumers
  (`OnHealthChanged`, HUD). Sync rather than delete to avoid breaking them.
- **A2 pass plumbing** — adding a module-specific pass must not change behavior
  for the other modules' evaluator runs (guard by module id).
