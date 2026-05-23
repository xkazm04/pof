# 08 · Harness & Testing — PoF App Improvements

## Goals

Codify the verification patterns the vertical-slice initiative proved into
first-class harness primitives, surface them in PoF, and reduce the cost
of adding a new system-level test from "rewrite one of PS-1/HUD/Characters'
specs" to "compose a few harness helpers + a Gemini-prompt fixture."

## Improvements

### 1. A library of reusable harness primitives

`e2e/helpers/` already has `harness-mode.ts`, `dispatch-helpers.ts`,
`waitForCliComplete`, `waitForCookComplete`, `seedPackagingProfile`.
Extract more from PS-1/HUD/Characters into named helpers:

- `runFunctionalTest(testPath)` — wraps the `UnrealEditor-Cmd ...
  Automation RunTests` invocation; parses the `Result={Success/Failure}`
  + per-assertion lines; returns `{success, criteria: {...}}`. Used by
  PS-3, HUD, Characters Task 3 already as ad-hoc code.
- `launchAndScreenshot({mapPath, resolution, settleSec})` — wraps the
  `UnrealEditor.exe ... -game -windowed HighResShot` pattern; returns
  the path of the newest screenshot. Used by every Gemini check.
- `geminiCheck(screenshotPath, promptOrFixtureName)` — wraps the
  `gemini-recognize.mjs` invocation, the personas env-loading, the
  cwd-bouncing. Promotes the pattern to a one-liner.
- `singleDispatch(spec)` — emits the SP-B single-dispatch isolation
  pattern (one isolated test per step); given a list of dispatches,
  produces one Playwright `test()` per dispatch.

### 2. A `gemini-prompts/` fixture directory

`e2e/fixtures/gemini-prompts/` holds canonical prompts per verification:
`character-check.txt`, `hud-check.txt`, `arena-check.txt`,
`texture-check.txt`, `enemy-distinction.txt`. Each file is the
discriminating prompt PS-2/PS-3/HUD/Characters' final Gemini checks
landed on, with the explicit yes/no question form. `geminiCheck()`
loads from this dir by short name.

### 3. A "run all verifications" composite spec

`e2e/all-verifications.spec.ts` — a top-level spec that runs every
system's verification (the functional test, then a Gemini check per
visible system: arena, characters, HUD). Used as the "is the slice
still healthy?" daily run. Replaces the per-sub-project ad-hoc verify
steps with one cohesive end-to-end pass.

### 4. CI-runnable harness mode

The harness currently runs locally against a running PoF dev server +
the user's UE install. For CI, add a "harness-only" mode that:

- Doesn't require the PoF dev server (uses recorded API responses or
  stubs).
- Doesn't require Blender / Leonardo (uses fixture textures + meshes).
- Runs `UnrealEditor-Cmd` headless against a checked-in UE-project
  snapshot to verify the functional test still passes.

A subset of `all-verifications` runs in CI on every PoF-app PR — catches
regressions in the harness itself.

### 5. A "first-launch wakeup" mode

The vertical-slice runs the editor + UE multiple times — each launch has
significant cold-start cost. Add a `keepAlive` harness mode where one
`UnrealEditor` session stays alive between dispatches (a long-lived
editor process exposing a Python eval socket). Several short tests reuse
the same editor; total wall-clock drops drastically. The `MoverTests`
plugin's plugin-content mount pitfall (which only works under the full
editor) is solved once per session.

### 6. Dispatch-reliability dashboards

The dispatch race + the CLI-subsystem fixes (SP-A → SP-B remediation)
deserve a permanent monitor. Add a small dev panel under
`src/components/cli/DispatchHealthPanel.tsx` showing: dispatches sent,
acknowledged, dropped, callback-POST timeouts, abnormal-exit recoveries.
Operators see at a glance whether the CLI subsystem is healthy. Catches
a regression of any of the fixes before a real run is wasted.

### 7. The "fix-and-rerun trap" linter

SP-B's biggest cost was running four 40-min live attempts. The pattern
since then has been: a deterministic synthetic fixture proves the fix
*before* a live dispatch. Codify: a Playwright lint rule (or a docs
checklist on every PR touching `e2e/helpers/`) requiring a
`page.setContent`-style fixture test for any harness behaviour change
before a `HARNESS_MODE=live` run is added to CI.

## Verification this work succeeded

- A new system's verification can be written by composing helpers in
  ~10 lines (versus the ad-hoc multi-page setup PS-1/HUD/Characters
  each had).
- The composite `all-verifications` spec runs end-to-end on a fresh
  checkout in < 10 minutes; failures are localised to a system.
- The CI harness runs on every PoF-app PR.
- The "fix-and-rerun trap" lint rule blocks a hypothetical live-run
  addition that has no fixture coverage.
