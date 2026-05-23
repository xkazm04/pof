# 07 · Packaging & Build — Test Coverage

## What we have

- `src/__tests__/packaging/cook-executor.test.ts` — 7 tests covering
  parse-phase markers, progress events, exe-path extraction, error/stderr
  inclusion, the spawn cmd-quoting setup. SP-C added these.
- `e2e/arpg-vertical-slice-sp-c.spec.ts` — the cook spec; drives the
  packaging UI to a real cook, asserts the staged exe exists.
- `e2e/arpg-vertical-slice-sp-e.spec.ts` — the SP-E launch smoke-test;
  spawns the staged exe + tasklist-confirms the game process survives.

## Tests to add — PoF app side

1. **Pre-flight pipeline test** — vitest of the new pre-flight panel:
   given a UE project state (passed in as test fixtures), assert each of
   build-verify, config-sanity, plugin-WITH_EDITOR-audit produces the
   expected red/green result. Mocks `UnrealBuildTool` exit + the .ini
   parse.
2. **Structured cook-log persistence test** — given a captured
   `cook-executor` event stream (a fixture from a known good cook),
   asserts the persisted `.jsonl` file matches the expected per-phase
   structure. Detects regressions in the log writer.
3. **`cmd.exe` quoting regression test** — already covered by SP-C's
   spawn-args test; extend to assert both `windowsVerbatimArguments:
   true` AND the outer-quote-wrap are present in the spawn invocation
   (one without the other was the bug PS-2/SP-C hit twice).
4. **Platform-profile defaults test** — vitest asserts each platform
   preset (Win64 Dev, Win64 Shipping, Linux Shipping, Android) produces
   a valid `BuildProfile` with the platform's required notes attached.
5. **Plugins panel parse test** — given a fixture `.uproject`, asserts
   the plugins-panel UI parses the `Plugins` array correctly and
   correctly enables/disables when toggled.

## Tests to add — game side

1. **`UnrealBuildTool` Shipping smoke test** — a tiny script (or just a
   step in `BuildPackage.bat`) that runs UBT on `PoF Win64 Shipping`,
   asserts `Result: Succeeded`. Run in CI on every push to the UE repo;
   catches the `bOverrideBuildEnvironment` / WITH_EDITOR / Constant3Vector
   class of bug at PR time.
2. **`grep` audit test** — a tiny shell script asserting `grep -rl
   'FEditorDelegates\|GEditor' Plugins/PillarsOfFortuneBridge/Source/
   PillarsOfFortuneBridge/Source` returns no unguarded hits. Wires the
   WITH_EDITOR audit into CI.
3. **`Config/DefaultGame.ini` sanity test** — asserts `ProjectID` is
   non-empty, `GameDefaultMap` / `EditorStartupMap` are set. Detects a
   regression where someone blanks `ProjectID` again.

## E2E harness extensions

1. **`packaging-e2e.spec.ts`** — supersedes `arpg-vertical-slice-sp-c.spec.ts`
   with the pre-flight panel: assert pre-flight is green; cook; smoke-
   test; report. End-to-end success criterion replacing the SP-C +
   SP-E specs with one cohesive flow.
2. **`packaging-failure-modes.spec.ts`** — deliberately seeds a
   regression (e.g. blank `ProjectID`); asserts pre-flight catches it
   *before* a cook is even started. Verifies the pre-flight saves
   diagnostic time.

## Lessons that motivate each test

- **`cmd.exe` quoting broke twice — and only after a real-cook attempt.**
  The unit-level spawn-args test is the cheap repeatable check; the
  pre-flight pipeline catches the same class higher up.
- **`PoF.Target.cs` had to be fixed once each for `Unique` and
  `bOverrideBuildEnvironment`.** The UBT smoke test in CI fails on the
  same regression at PR time, not at cook time.
- **The bridge plugin's runtime-module WITH_EDITOR violation took a
  Shipping cook to surface.** The grep audit is cheap and headless.
- **An empty `ProjectID` blocked the cook end-of-cook.** The .ini sanity
  test is a one-line vitest that protects against the regression.
- **SP-C+SP-E were two separate dispatches** — the unified packaging-
  e2e spec collapses them into one "the build pipeline is healthy" gate.

## What this folder does *not* test

Game content (characters, HUD, gameplay, environment, materials) — those
have their own tests. The packaging tests verify the **pipeline** works;
the content tests verify the **game** works.
