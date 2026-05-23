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

### After sub-project 08 (this work)

The infrastructure this folder proposed now largely exists — see `pof-app.md`
and `game.md` for the per-item status. In short: the harness primitive library,
the Gemini-prompt fixtures, the composite `all-verifications` spec, the CI
harness mode, the dispatch-health dashboard, the fix-and-rerun detector (PoF
app), and the `AARPGFunctionalTestBase`, `PoF.HealthCheck`, `ARPG.Verify.*`
commands, test-damage notify, and cooked smoke self-check (UE project) are all
implemented and committed (locally — both repos 403 on push). Two caveats carry
forward: the **UE link/runtime is unverified** (the editor DLL was held by a
concurrent live session, so only compilation is confirmed), and the
**`DispatchHealthPanel` is not yet surfaced in-app** (its reducer is unit-tested,
but the panel was not browser-verified).

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

## Proposed next development directions

New directions beyond the original brief, ordered roughly by leverage. (The
unfinished items from the original plan — keep-alive transport, linter
enforcement, CI UE snapshot, per-system tests, the remaining meta-tests — are
tracked as "remaining planned work" in `pof-app.md` / `game.md` / `tests.md`
and are not repeated here.)

1. **Close the runtime-verification gap first.** Once the editor is free, link
   the UE module and actually run `Project.Functional Tests.PoF.HealthCheck` and
   `ARPG.Verify.Slice` in PIE, plus a cooked `ARPG.Verify.SliceCI` exit-code
   check. Capture the real `Automation RunTests` log as a fixture for the parser
   tests — everything downstream assumes these pass.

2. **Surface the dispatch dashboard.** Mount `DispatchHealthPanel` in a dev
   drawer / the CLI panel footer behind a flag, then browser-verify it and add
   the dispatch-reliability stress spec. An invisible health panel catches
   nothing.

3. **Make the harness self-checking in CI.** Combine the fix-and-rerun linter
   (as a blocking `npm run validate` step) with `harness-meta.spec.ts` so a PR
   that regresses a helper or adds an unproven live run fails fast — the harness
   guards itself, not just the game.

4. **A verdict-history store + drift detection.** Persist each
   `all-verifications` run (functional results + Gemini verdicts) to
   `~/.pof/pof.db` and diff against the last green run. Surfaces *gradual* decay
   (a Gemini gate slowly degrading, a flaky assertion) that a single pass/fail
   hides — and gives the dashboard real history rather than a live snapshot.

5. **Editor-pool / warm-editor service.** Generalise the keep-alive transport
   into a small long-lived service that the harness, the CLI tasks, and ad-hoc
   `ARPG.Verify.*` runs all share — amortising cold-start across the whole
   pipeline, not just one spec.

6. **Promote `ARPG.Verify.*` into the per-system gate contract.** Have each
   system's functional test (folders 02–07) and its `ARPG.Verify.<System>`
   command assert the *same* invariants from both the PIE and cooked paths, so a
   regression that only manifests in the packaged build can't slip through.

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
