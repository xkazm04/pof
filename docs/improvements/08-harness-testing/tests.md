# 08 · Harness & Testing — Test Coverage (the meta-tests)

This folder's "tests" are the tests-of-the-tests — coverage on the harness
primitives themselves, so a regression in the verification infrastructure
doesn't quietly invalidate per-system gates.

## What we have

- `e2e/helpers/verification-core.test.ts` — the `parseAutomationLog` parser
  (success extraction, failure detection, **anti-gaming guard**, empty log),
  `pickNewestScreenshot` (newest-by-mtime), `resolveGeminiPrompt`,
  `buildGeminiArgs`, and `parseVerifyResult` (PASS/FAIL line scan). ✅
- `e2e/helpers/single-dispatch.test.ts` — asserts `singleDispatch` produces one
  isolated `test()` per dispatch with a fresh page. ✅ (the SP-B isolation lesson)
- `e2e/helpers/ci-harness.test.ts` — mode resolution, UE-presence gating, the CI
  vs full plans. ✅ (unit level)
- `e2e/helpers/keep-alive-editor.test.ts` — launch-arg construction + the
  session lifecycle / serialization / reuse counting against a fake transport. ✅
- `e2e/helpers/fix-and-rerun-lint.test.ts` — the violation detector. ✅
- `src/components/cli/dispatchHealth.test.ts` — `computeDispatchHealth` folding
  of the `cli.*` stream (incl. the stuck-dispatch signature). ✅
- `src/__tests__/lib/cli-dispatch.test.ts`, `cook-executor.test.ts`,
  `e2e/harness-redispatch.spec.ts` — pre-existing harness coverage.
- `Project.Functional Tests.PoF.HealthCheck` — the project-invariant suite
  itself (a test); written, runtime run pending the editor-free window. ✅

## Tests still to add

### Harness library

1. **`geminiCheck` env-loading test** — vitest mocks the `personas/.env` read +
   the `gemini-recognize.mjs` spawn; asserts the helper passes the script/args
   correctly and bounces cwd. Detects regressions in the spawn wrapper. ⬜

### Fixture coverage

1. **`gemini-prompts/*.txt` lint** — vitest asserts each fixture prompt contains
   an explicit yes/no question (heuristic: a `?` plus an "is there"/"can you
   tell"-style framing). Stops a regression to fuzzy "describe the scene"
   prompts. ⬜
2. **End-to-end CI-mode verdict** — `ci-harness` is unit-tested, but the full
   path (CI mode runs `runFunctionalTest` with no dev server / no Blender / no
   Leonardo and yields a real functional-test verdict) is not yet exercised. ⬜

### Game side

1. **`AARPGFunctionalTestBase` self-test** — a tiny `AFunctionalTest` extending
   the base that asserts its helpers (`GetPlayerCharacter` etc.) return non-null
   in a known PIE map. Detects regressions in the base class. ⬜

### E2E harness extensions

1. **`harness-meta.spec.ts`** — exercises every harness helper end-to-end against
   the live UE project (`runFunctionalTest`, `launchAndScreenshot`,
   `geminiCheck`, `singleDispatch`); the "harness itself is healthy" gate; runs
   before `all-verifications`. ⬜
2. **Dispatch-reliability stress test** — a synthetic page firing N rapid
   dispatches at a stubbed CLI; asserts every one is delivered exactly once and
   `DispatchHealthPanel` reports zero drops / zero stuck. The cheap recurring
   guard for the SP-A/SP-B CLI-subsystem fixes. ⬜

## Lessons that motivate each test

- **"Don't trust the report"** (SP-B/Characters) — the parser tests (done) and
  the harness-meta spec (planned) verify the verification machinery is honest. A
  parser that mis-reads `Result={Failure}` as `Success` passes every per-system
  test wrongly.
- **Gemini-prompt design is load-bearing.** The fixture-lint test (planned)
  enforces discriminating prompts.
- **The dispatch race took SP-A + a 4-run SP-B saga to close.** The reliability
  stress test (planned) is the cheap recurring guard.
- **Cold-start `claude.exe` pushed the appear-grace window 4 s → 90 s.** The
  parser-test fixtures should include a slow run so a 30 s-timeout regression fails.

## What this folder does *not* test

Per-system gameplay or content — those tests live in folders 02–07. This folder
verifies the **infrastructure**: the harness helpers, the prompt fixtures, the
CI mode, the parsers, the dispatch reliability.
