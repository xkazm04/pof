# 01 · Generation Quality — Test Coverage

## What we have

The PoF app already has substantial vitest coverage (`src/__tests__/`) and
a Playwright e2e harness (`e2e/`). The vertical-slice initiative *added* the
in-engine functional-test pattern (`AVSFunctionalTest`) and the Gemini-vision
sanity-check pattern (`gemini-recognize.mjs`). Generation-quality tests
extend both.

## Tests to add — PoF app

1. **Prompt-builder snapshot tests** for the new "Wiring Requirements"
   section. A vitest test in `src/__tests__/prompts/` feeds each module
   checklist item through the builder and asserts the prompt contains the
   `Wiring Requirements` heading + non-empty granting/activation/dependencies
   subsections.
2. **`ue-gotchas` knowledge-pack injection test.** A vitest test that any
   prompt classified as "UE C++" or "UE Python" includes the known-gotchas
   pack — guard against silent regression.
3. **`Pass 0 — Ground Truth` evaluator-prompt test.** Snapshot the evaluator
   output for a sample module and assert Pass 0 is present and structurally
   correct.
4. **`wiringAssets` coverage check** — a vitest test that for every feature
   in `feature-definitions.ts`, either `wiringAssets` is set (possibly to
   `[]`) or the test fails with the feature name. Forces an explicit
   decision per feature, not an omission.

## Tests to add — game side

1. **`UVSHUDWidget`-style pattern test** — a C++ test (or a tiny
   `AFunctionalTest`) that constructs the `ARPGCodeWidgetBase`-derived widget
   from a CodeWidget conventions doc, adds it to the viewport, and verifies
   the SlateWidget tree has the expected children. Catches a recurrence of
   the `NativeConstruct` vs `RebuildWidget` trap.
2. **`ARPGCharacterBase::DefaultAbilities` smoke test** — an
   `AFunctionalTest` that spawns a character, possesses it, and asserts the
   ASC has each entry in `DefaultAbilities` granted. Generalises the PS-1
   `AVSFunctionalTest`'s #3 assertion into a reusable pattern.
3. **`ARPG.SelfCheck.*` console commands** are themselves the
   "self-test" infrastructure — every new generated system adds one. The
   functional-test framework can iterate every `SelfCheck.*` command and
   fail if any reports `FAIL`.

## E2E harness extensions

1. **A "wiring smoke run" harness mode** — `HARNESS_MODE=wiring-smoke` —
   that for each module in the registry: drives a single dispatch, then
   asserts the generated artifacts include a discoverable `Wiring
   Requirements` block in the dispatch's output JSON. Detects regressions
   in the prompt builder's wiring-requirement injection.
2. **A `gemini-recognize.mjs` plumbing test** — a Playwright e2e that runs
   the `gemini-recognize.mjs` CLI against a known reference PNG (committed
   into `e2e/fixtures/`) and snapshots the response shape. The HUD,
   Characters, and PS-3 sub-projects all depended on Gemini reads — a broken
   CLI would silently degrade those gates.

## Lessons that motivate each test

- **"Compiles but never wired" found by hand in 5 sub-projects.** The
  wiring-requirements tests force the prompt builder to demand the wiring
  PoF previously discovered too late.
- **Constant3Vector pin-name silently returned false.** Until UE
  Python-side mocks exist, the prevention is a documented gotcha + a
  `tests.md`-mandated lifecycle log that confirms each connect call returned
  true. A vitest snapshot of the gotchas list catches accidental deletion.
- **Single-dispatch isolation succeeded where chained dispatch failed.**
  The harness wiring-smoke mode codifies the isolation: one dispatch per
  test, fresh page, no chained side-effects.
- **Each Gemini check was load-bearing for a sub-project's gate.** The
  plumbing test stops a silent regression in the CLI tool from passing a
  broken visual gate.

## What this folder explicitly does *not* test

Per-system gameplay (combat, character, HUD behaviour) is tested by the
other folders' `tests.md`. Tests here cover only the *generation pipeline*
itself — the PoF code that turns a checklist item into Claude-generated UE
code, and the conventions on the UE side that make that generation easier to
get right.
