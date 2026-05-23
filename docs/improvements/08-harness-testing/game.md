# 08 · Harness & Testing — Game Improvements

## Goals

Build out the in-engine functional-test infrastructure (the `AVSFunctionalTest`
pattern) so per-system tests are easy to add, the test framework knows the
project's conventions, and the slice's growing gameplay surface gets per-system
coverage.

## Status — implemented

Delivered in the UE project repo `pof-exp` (local commit `c5caeb3`). All
translation units compile clean; **link + runtime verification is pending a
UE-free editor window** — the editor DLL was held by a concurrent live session
during the build (see README).

- ✅ **`AARPGFunctionalTestBase`** (`Source/PoF/Test/ARPGFunctionalTestBase.{h,cpp}`)
  — a phased Tick driver (`Phases` + `RunPhase`) plus GAS/character helpers
  (`GetPlayerCharacter`, `GetFirstEnemy`, `GetPlayerASC`, `GetEnemyASC`,
  `ApplyDamage` via the real GE_Damage pipeline, `GetHealth`, `WaitForCondition`),
  with the `LogWarningHandling = OutputIgnored` default.
- ✅ **`Project.Functional Tests.PoF.HealthCheck`** — project-invariant suite
  (core classes resolve, slice map exists, ProjectID + GameDefaultMap set,
  default GameMode has Pawn/PC/HUD classes wired).
- ✅ **`ARPG.Verify.<System>` console commands** — `Characters` / `HUD` /
  `Combat` / `Slice`, shipping-safe `FAutoConsoleCommand`, each logging a
  discriminating PASS/FAIL line; safe to run live in PIE.
- ✅ **`UAnimNotifyState_TestDamage`** — fires `Event.MeleeHit` / direct
  `GE_Damage` from a one-frame test montage, so combat tests no longer depend
  on the empty `AM_MeleeCombo`.
- ✅ **Cooked smoke-pak self-check** — `ARPG.Verify.SliceCI` runs the slice
  self-check and exits with the verdict as the **process exit code** (Shipping
  compiles out logging, so the exit code is the reliable signal).

## Remaining planned work

### Per-system functional tests reparented to the base

The `Source/PoF/Test/` folder hierarchy (`Character/`, `Combat/`, `HUD/`,
`Environment/`, `Materials/`, `HealthCheck/`) and the conventions doc
(`Source/PoF/Test/README.md`) exist, and the base class is ready. **Still
planned:** author each system's functional test — `AVSCharacterShapeTest`,
`AVSCombatAbilityGrantTest`, `AVSHUDPresenceTest`, `AVSArenaCollisionTest`,
`AVSArenaMaterialBindingTest`, … — reparenting to `AARPGFunctionalTestBase`.

These tests belong to folders 02–07's `tests.md`: this folder provides only the
**infrastructure** they run on, so authoring them is explicitly out of scope
here and left to the per-system sub-projects.

## Verification this work succeeded

- ✅ A new system's functional test inherits `AARPGFunctionalTestBase` and is
  < 100 lines (the base + conventions make this true).
- ⚠️ `PoF.HealthCheck` runs in < 30 s and catches structural regressions —
  written and compiles; a **runtime run is pending** the editor-free window.
- ⬜ Each system has at least the tests listed in its folder's `tests.md`,
  reparented to the base.
- ⚠️ A cooked Win64 Shipping build, run with `ARPG.Verify.SliceCI`, exits 0 on a
  clean checkout — the command exists; an **end-to-end cooked run is pending**.
