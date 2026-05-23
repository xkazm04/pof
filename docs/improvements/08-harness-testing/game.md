# 08 · Harness & Testing — Game Improvements

## Goals

Build out the in-engine functional-test infrastructure (the
`AVSFunctionalTest` pattern) so per-system tests are easy to add, the
test framework knows the project's conventions, and the slice's growing
gameplay surface gets per-system coverage.

## Improvements

### 1. A test base class — `AARPGFunctionalTestBase`

`AVSFunctionalTest` re-invents the four-phase Tick state-machine
pattern. Extract a base class `AARPGFunctionalTestBase : AFunctionalTest`
in `Source/PoF/Test/ARPGFunctionalTestBase.{h,cpp}` providing:

- A phased Tick driver — subclasses populate a `TArray<FName>` of phase
  names + a `RunPhase(int idx, float dt)` virtual.
- Helpers: `GetPlayerCharacter()`, `GetFirstEnemy()`,
  `GetPlayerASC()`, `GetEnemyASC()`, `ApplyDamage(target, amount)`,
  `WaitForCondition(predicate, timeout)`.
- The `LogWarningHandling = OutputIgnored` default the Characters
  sub-project landed on.

Per-system tests reparent to this base; the per-test boilerplate drops
~70%.

### 2. Per-system functional tests as named, discoverable suites

Promote the cross-system tests folders 02–07's `tests.md` propose
(`AVSCharacterShapeTest`, `AVSCombatAbilityGrantTest`,
`AVSHUDPresenceTest`, `AVSArenaCollisionTest`,
`AVSArenaMaterialBindingTest`, …) into a `Source/PoF/Test/`
sub-folder hierarchy:
`Source/PoF/Test/Character/`, `Source/PoF/Test/Combat/`,
`Source/PoF/Test/HUD/`, `Source/PoF/Test/Environment/`,
`Source/PoF/Test/Materials/`.

The automation framework auto-discovers `AFunctionalTest`s placed in
maps — but for tests that don't need a map (pure GAS damage execution,
material connection), use `IMPLEMENT_SIMPLE_AUTOMATION_TEST` in the
same folder. Both run via the same `Automation RunTests` invocation.

### 3. A `Project.Functional Tests.PoF.HealthCheck` suite

A meta-test that asserts the project's invariants:
- Every C++ ability class compiles + has a sensible activation tag.
- Every `BP_VS*` Blueprint has the expected components.
- `BP_VSGameMode` has `HUDClass`, `DefaultPawnClass`, `PlayerControllerClass` set.
- `Config/DefaultGame.ini` `ProjectID` non-empty,
  `GameDefaultMap` set.
- The mannequin assets resolve.
- The slice level exists at `/Game/Maps/VerticalSlice`.

Run as the first thing in any CI pass. Catches "someone broke the
project structure" before the per-system tests start failing in
confusing ways.

### 4. A console command for ad-hoc verification

`ARPG.Verify.<System>` console commands (per
[[../01-generation-quality/game.md]] §6) let an operator run a
single-system check live in PIE without dispatching the harness.
Especially useful when iterating in the editor.

### 5. Test-mode AnimNotifyState for damage events

The PS-1 functional test sends `Event.MeleeHit` directly because the
empty `AM_MeleeCombo` has no notify. Add a `UAnimNotifyState_TestDamage`
that any test can place inline on a one-frame test montage to fire the
event reliably — independent of the real montage's contents. Lets
combat tests run without the real `AM_MeleeCombo` either.

### 6. A "smoke pak" for cooked-build verification

SP-E spawned the staged exe + tasklist-checked. Extend the smoke-test
to also pass `-ExecCmds="ARPG.Verify.Slice;Quit"` so the packaged exe
runs an in-game self-check and exits — verifying not just "the process
starts" but "the gameplay loop actually works in the cooked build."
Bridges SP-E (process-level) and the functional test (PIE-level) for the
packaged path.

## Verification this work succeeded

- A new system's functional test inherits `AARPGFunctionalTestBase`
  and is < 100 lines.
- `Project.Functional Tests.PoF.HealthCheck` runs in < 30 s and
  catches structural regressions deterministically.
- Each system has at least the tests listed in its folder's `tests.md`,
  reparented to the new base.
- A cooked Win64 Shipping build, run with `ARPG.Verify.Slice`, exits 0
  on a clean checkout and prints `PASS`.
