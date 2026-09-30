# Combat defect: attacker AttackPower adds 0 damage (handoff from /diablo W05–W06)

**Status:** open — **priority raised by the operator 2026-09-24 (/diablo D26: converted monster HP is ~1.5x too high in play until this is fixed)** · **Owner:** PoF combat track (handed off by the /diablo loop, operator decision D21, 2026-09-22) ·
**Not fixed by /diablo** — this is PoF's damage formula, not a replication item.

## Symptom

`UARPGDamageExecution` documents `RawDamage = BaseDamage + AttackPower * Scaling`. In a real headless run the
attacker's AttackPower contributes nothing:

| Case | Expected | Observed |
|---|---|---|
| Physical melee hit, BaseDamage 20, attacker AttackPower 10, target Armor 4 | (20+10)·(1−4/104) = **28.85** | **19.23** = 20·(1−4/104) |
| Physical GE_Damage spec, base 40, same attacker/target | (40+10)·(1−4/104) = 48.08 | **38.46** = 40·(1−4/104) |

Everything else in the formula checks out in the same run: armour mitigation, and the elemental resistances
(Magic 50% → exactly ½, Chaos 25% → exactly ¾ of the physical reference hit).

## Evidence

- Test: `Source/PoF/Test/Combat/VSCombatDamageFormulaTest.{h,cpp}` (UE repo). It existed but had **never been
  placed in any map, so it had never run**; it is now placed in VerticalSlice by `Content/Python/place_combat_tests.py`
  (UE `8534e08`). Its first assertion ("damage formula") fails every run; the later phases pass.
- Run: `UnrealEditor-Cmd.exe PoF.uproject "-ExecCmds=Automation RunTests VSCombatDamageFormulaTest"
  "-TestExit=Automation Test Queue Empty" -nullrhi -abslog=<log>` → `Result={Fail}`,
  `damage formula: applied 19.23 should equal 28.85`.
- Capture def looks right: `DEFINE_ATTRIBUTE_CAPTUREDEF(UARPGAttributeSet, AttackPower, Source, false)`
  (`ARPGDamageExecution.cpp:22`).

## Where to look first (hypothesis, not verified)

The test raises the attacker's AttackPower with `ApplyModToAttribute(..., Override, 10)`, which changes the
**base** value. If `GE_InitAttributes` is an infinite-duration effect with **Override** modifiers (it sets every
attribute from the `FARPGAttributeInitRow` via SetByCaller), the aggregated **current** value stays pinned to the
row's AttackPower (likely 0) no matter what the base becomes — so the capture reads 0. If that is it, both the test
and any gameplay buff that edits base AttackPower are affected; the fix is the init GE's duration/mod op (or the
test raising AttackPower through a GE), not the execution.

Related: fleet-memory 2026-09-22 [ue]; vault `Diablo/Backlog.md` D21.

## New evidence (/diablo W07, 2026-09-24)

- **The hypothesis above is disproved.** `GE_InitAttributes` is never applied to anyone: no
  `DT_AttributeDefaults` asset exists in the project, so every character logs
  `InitializeAttributes: missing ASC or AttributeInitTable` (BP_JediPlayer, BP_VSPlayer, BP_VSEnemy) and runs on
  `UARPGAttributeSet`'s constructor defaults. No Override-mod GE is pinning AttackPower.
- **It happens in real gameplay, for the PLAYER.** Headless VerticalSlice scenario (player fires
  `Ability.Melee.LightAttack` at a Diablo zombie with MaxHealth 44.34, Armor 0): the log says
  `Applied damage to BP_Zombie_C_0: Base=20.0 x Combo=1.00`, and the zombie's GAS Health reads
  44.34 → 24.34 → 4.34 — **exactly 20 per hit**, where the documented formula with the player's default
  AttackPower 10 gives 30.
- **An ENEMY's AttackPower does contribute:** in W06 the zombie (constructor-default AttackPower 10, BaseDamage
  3.5) hit the player for 13.5. So the loss is on the player's side of the execution (source capture of the
  player's ASC / attribute set), not in the formula.
- Separate defect found in the same runs, fixed in UE `25812c2`: `GA_EnemyMeleeAttack` applied every swing
  twice (one overlap result per component). `GA_EnemyChargeAttack`, `GA_ForcePush`, `GA_GroundSlam` and
  `GA_VS09Smite` iterate `OverlapMultiByChannel` the same way with no per-actor dedupe — not fixed, not measured.
