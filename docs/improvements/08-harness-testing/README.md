# 08 · Harness & Testing

## Scope

The cross-cutting test + verification infrastructure: the Playwright e2e
harness (`e2e/`), in-engine `AFunctionalTest`s (`Source/PoF/Test/`), the
Gemini-vision verification pattern, the dispatch reliability and
single-dispatch isolation model, and the harness-mode helpers
(`e2e/helpers/harness-mode.ts`).

## Current state

After SP-A → SP-B's single-dispatch rework → SP-C → SP-E → PS-1's
`AVSFunctionalTest` → the HUD + Characters Gemini gates:

- **The e2e harness** (`e2e/helpers/harness-mode.ts`) has stub/live modes,
  a recorder for dispatch events, a `waitForCliComplete` watcher tuned
  for cold-start `claude.exe` (90 s appear-grace window post-SP-B), a
  `seedPackagingProfile` helper, a `waitForCookComplete` watcher, a
  `writeFindings` summariser.
- **In-engine testing** uses `AFunctionalTest` (`Source/PoF/Test/VSFunctionalTest.cpp`)
  with the four-phase Tick state-machine pattern: movement → ability
  activation → damage → death+loot. Run via
  `UnrealEditor-Cmd -ExecCmds="Automation RunTests Project.Functional
  Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause
  -nullrhi -log`. The test harness uses `LogWarningHandling =
  OutputIgnored` to tolerate gray-box anim warnings.
- **Gemini vision** verifies real-launch screenshots via
  `personas/.claude/skills/leonardo/tools/gemini-recognize.mjs` — used
  in PS-2 (arena read), PS-3 (texture read), HUD (bars visible),
  Characters (humanoid + distinct enemy). Prompt-design is load-bearing
  ("can you clearly tell them apart?" not "describe").
- **Single-dispatch isolation** (SP-B's rework) — each operator-flow
  step runs as its own isolated Playwright test (fresh page), avoiding
  the chained-`isRunning` collision that hung four 40-min runs.
- **Dispatch reliability** — SP-A's `pof-cli-terminal-ready` handshake
  + the `dispatchPromptWhenReady` helper closed the dispatch race that
  blocked SP-B's chunked runs.
- **CLI subsystem fixes** from SP-B's remediation: `CompactTerminal`'s
  direct-submit + the `onerror` task-completion + the callback-POST
  raced-against-timeout.

## Key lessons

1. **Single-dispatch isolation works.** Chained dispatches in one page
   fought `isRunning` collisions; isolated tests sidestep the entire
   class.
2. **Prove fixes deterministically before live runs.** SP-A and D9 both
   proved their fixes with a synthetic Playwright fixture before
   running anything live. Burning 40 minutes on "the next fix is the
   last one" is the failure mode; the fixture-first pattern is the
   fix.
3. **Gemini prompt design is the verification.** "Describe this scene"
   is a fuzzy gate; "is there a health bar in the top-left, and a
   separate bar near the top-centre?" is sharp. Every Gemini check
   needs a discriminating prompt.
4. **Headless functional tests prove gameplay; real-launch screenshots
   prove visuals.** The split is correct — the functional test runs
   `-nullrhi`, won't render the HUD; the Gemini screenshot is the
   visual gate. The two don't replace each other.
5. **`AddOnScreenDebugMessage` overlays everything** — a confounder for
   Gemini reads. Either suppress in tests or place around.
6. **"Don't trust the report."** SP-B's spec reviewer found criterion
   #5 was gamed by a direct `SetNumericAttributeBase(Health, 0)` poke;
   the Characters Task 3 implementer's "MaxHealth = 0" diagnosis turned
   out to be wrong (it was a `NativeConstruct` vs `RebuildWidget`
   timing bug). Verify by reading the code / running independently.
7. **Each sub-project's Task 1 was discovery.** The pattern was: send
   an inventory agent before the plan, surface ground-truth, write the
   plan against reality. Every successful sub-project did this.

## Isolated-CLI session focus

A session works on:
- **PoF app:** `e2e/`, `e2e/helpers/`, `e2e/fixtures/`,
  `src/lib/harness/`, `src/lib/cli-dispatch.ts`,
  `src/components/cli/`, `src/__tests__/setup.ts`.
- **UE project:** `Source/PoF/Test/`, the `AFunctionalTest` and
  automation-test conventions.
- **Skills / external:** `personas/.claude/skills/leonardo/tools/
  gemini-recognize.mjs` invocation conventions, fixture prompts.

It does *not* author per-system gameplay tests directly — those belong
in folders 02–07's `tests.md`. This folder's work is the **infrastructure**
the per-system tests run on top of.
