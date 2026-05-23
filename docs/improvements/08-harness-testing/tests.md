# 08 · Harness & Testing — Test Coverage (the meta-tests)

This folder's "tests" are the tests-of-the-tests — coverage on the
harness primitives themselves, so a regression in the verification
infrastructure doesn't quietly invalidate per-system gates.

## What we have

- `src/__tests__/lib/cli-dispatch.test.ts` — SP-A's ready-handshake +
  dispatch test (4/4).
- `src/__tests__/packaging/cook-executor.test.ts` — 7 tests on the cook
  executor primitives.
- `e2e/harness-redispatch.spec.ts` — D9's synthetic fixture proving the
  redispatch wall-clock guard.
- `e2e/arpg-vertical-slice-sp-*.spec.ts` — per-sub-project specs (these
  exercise the harness but don't test it directly).

## Tests to add — harness library

1. **`runFunctionalTest` parser tests** — vitest on the parser that
   extracts `Result={Success/Failure}` + per-assertion lines from an
   `Automation RunTests` log. Fixture: captured outputs from PS-1, HUD,
   Characters Task 3. Detects log-format changes the parser would miss.
2. **`launchAndScreenshot` newest-file selection test** — vitest with
   a fixture screenshots dir; asserts the helper returns the newest
   PNG by mtime. Detects the "two HighResShot runs in a row, picked
   the wrong one" class of confusion.
3. **`geminiCheck` env-loading test** — vitest mocks `personas/.env`
   read + the `gemini-recognize.mjs` spawn; asserts the helper loads
   `GEMINI_API_KEY` correctly and bounces cwd. Detects regressions in
   the bash-incantation wrapper.
4. **`singleDispatch` test-generation test** — vitest asserts the
   helper produces N isolated `test()` blocks for N dispatches, each
   with a fresh page. Codifies the SP-B isolation lesson.

## Tests to add — fixture coverage

1. **`gemini-prompts/*.txt` lint** — vitest asserts each fixture prompt
   contains an explicit yes/no question (heuristic: a `?` near the end
   plus a "is there"/"can you tell"-style framing). Stops a regression
   to fuzzy "describe the scene"-style prompts.
2. **CI harness-mode coverage test** — given the harness's mock fixtures,
   asserts the CI mode runs without a PoF dev server / without Blender /
   without Leonardo, and produces a valid functional-test verdict.

## Tests to add — game side

1. **`AARPGFunctionalTestBase` self-test** — a tiny `AFunctionalTest`
   that extends the base, asserts the base's helpers
   (`GetPlayerCharacter` etc.) return non-null in a known PIE map.
   Detects regressions in the base class.
2. **`Project.Functional Tests.PoF.HealthCheck`** ([[game.md]] §3)
   *is* a test — it asserts the project's invariants. Runs as the first
   thing in CI / on every harness pass.

## E2E harness extensions

1. **`harness-meta.spec.ts`** — exercises every harness helper end-to-
   end against the live UE project (`runFunctionalTest`,
   `launchAndScreenshot`, `geminiCheck`, `singleDispatch`); asserts
   each helper returns the expected shape and the underlying tool
   succeeds. The "harness itself is healthy" gate; runs before
   `all-verifications` in any composite pass.
2. **Dispatch-reliability stress test** — a synthetic page that fires
   N rapid dispatches at a stubbed CLI; asserts every one is delivered
   exactly once and the dispatch dashboard reports zero drops. Detects
   regressions in the CLI-subsystem fixes from SP-A/SP-B.

## Lessons that motivate each test

- **"Don't trust the report"** (SP-B/Characters) — the parser tests
  + the harness-meta spec verify that the verification machinery
  itself is honest. If the parser silently mis-reads `Result={Failure}`
  as `Success`, every per-system test passes wrongly.
- **Gemini-prompt design is load-bearing.** The fixture-lint test
  enforces discriminating prompts; the helper's snapshot test stops
  a silent regression in the CLI invocation.
- **The dispatch race took SP-A + a 4-run SP-B saga to close.** The
  reliability stress test is the cheap recurring guard.
- **Cold-start `claude.exe` took the appear-grace window 4 s → 90 s
  (SP-B run 2).** The `runFunctionalTest` parser test fixture
  represents a slow run, so a regression that times out at 30 s would
  fail.

## What this folder does *not* test

Per-system gameplay or content — those tests live in folders 02–07.
This folder verifies the **infrastructure**: the harness helpers, the
prompt fixtures, the CI mode, the parsers, the dispatch reliability.
