# 03 · Combat — Test Coverage

## What we have

- The PS-1 `AVSFunctionalTest` covers a single hit's end-to-end damage path
  + the death + loot chain — both in the test-sends-the-event mode and
  (after the Characters fix) with a live AnimInstance.
- `Source/PoF/AbilitySystem/` has no in-engine combat tests — every check
  is via the high-level functional test.

## Tests to add — UE side (`AFunctionalTest`s)

1. **`AVSCombatGrayBoxPathTest`** — sets `bUseAnimationDrivenDamage = false`
   on `BP_GA_MeleeAttack`; activates the ability; asserts damage applies
   without sending `Event.MeleeHit`. The gray-box default works alone.
2. **`AVSCombatAnimationDrivenPathTest`** — when a real `AM_MeleeCombo` is
   in place (gated on the asset having sequences), sets
   `bUseAnimationDrivenDamage = true`; activates; advances animation; asserts
   damage applied via `OnMeleeHit` (a log line or a counter). Until the real
   montage lands, this test is `disabled` with a clear reason.
3. **`AVSCombatDamageFormulaTest`** — calls the damage execution directly
   with a known source attacker (`AttackPower = 10`) and target
   (`Armor = 4`); asserts `final_damage = (base + 10 - 4) * 1` per the
   formula. Detects regressions in `UARPGDamageExecution`.
4. **`AVSCombatAbilityGrantTest`** — asserts the player's ASC has every
   ability in `BP_VSPlayer::DefaultAbilities` granted post-`PossessedBy`.
   Generalises the PS-1 grant check; future "we added an ability but didn't
   grant it" regressions fail this immediately.
5. **`AVSCombatTwoHealthSystemsTest`** — explicitly asserts the relationship
   between `AARPGPlayerCharacter::GetHealth()` (plain float) and
   `ASC->GetNumericAttribute(GetHealthAttribute())`. After [[game.md]] §5
   lands, asserts they are equal. Until then, the test documents the
   inequality (skipped with a "TODO: resolve parallel state" message) so
   the gap is visible.

## Tests to add — PoF app side

1. **`bUseAnimationDrivenDamage` prompt test** — vitest snapshot of the
   `arpg-combat` checklist's `GA_*` generation prompt asserts it specifies
   `bUseAnimationDrivenDamage = false` as the default and references the
   gray-box-correct activation path.
2. **`combat-trace` evaluator-pass snapshot** — for a fixture
   `GA_MeleeAttack`, snapshot the evaluator's Pass 4 output; the
   call-graph must include the attribute reads/writes + flagged binary
   deps. Detects prompt regressions.
3. **`DT_AttributeDefaults` content presence test** — vitest reads the UE
   project's `Content/Data/` directory listing (via a small helper or a
   committed fixture) and asserts `DT_AttributeDefaults.uasset` exists.
   Until the asset exists, the test points at the gap.

## E2E harness extensions

1. **A `combat-loop` e2e spec** in `e2e/`: drives PoF's combat module on a
   fresh UE project (dispatch one ability checklist item), runs the
   resulting code through `AVSCombatGrayBoxPathTest` + `AVSCombatAbilityGrantTest`,
   asserts the dispatch produces a wired-and-runnable ability. The exit
   criterion for a successful generation of any new combat ability.
2. **Gemini "hit feel" check** — once [[game.md]] §6 lands, capture a
   short screenshot pair (pre-hit, hit-frame) and ask Gemini if the second
   frame visibly differs (impact effect). Loose but a real "did the polish
   land" gate.

## Lessons that motivate each test

- **The empty-montage code path bit twice.** The two-mode functional tests
  (`GrayBox` + `AnimationDriven`) plus the `bUseAnimationDrivenDamage`
  prompt snapshot prevent the *third* regression where someone removes the
  toggle.
- **PS-1 had to send `Event.MeleeHit` from the test.** The gray-box
  functional test now asserts damage applies *without* the event send —
  the hack becomes a fallback, not a load-bearing assumption.
- **The parallel-Health state is a latent footgun.** Documenting the
  inequality in a test makes the gap visible until [[game.md]] §5 resolves
  it; then the test becomes a regression guard.
- **Granting abilities was the most-repeated wiring gap.** The
  `AVSCombatAbilityGrantTest` codifies the pattern PS-1 had to add
  manually.

## What this folder does *not* test

Character mesh/anim (folder 02), HUD bar updates (folder 04), level
collision (folder 05). Combat changes that visibly affect those — e.g. the
player health bar going down when hit — are tested *there*; the combat tests
here verify the underlying damage / death / event mechanics only.
