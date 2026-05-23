# 07 · Packaging & Build — PoF App Improvements

## Goals

Make the packaging pipeline (a) diagnose every failure clearly, (b) catch
the recurring build-config defect class (build environment, ProjectID,
WITH_EDITOR audit) at pre-flight time, (c) cover multiple platforms beyond
Win64 Shipping, and (d) prove the produced `.exe` is runnable
automatically.

## Shipped (detail removed from this plan)

- **Pre-flight checklist** (was §1) — config-sanity + plugin WITH_EDITOR
  audit + opt-in UBT build-verify, gating the cook button until green or
  explicitly overridden. Commit `49726e7`.
  (`src/lib/packaging/preflight.ts`, `/api/packaging/preflight`,
  `PreflightPanel.tsx`.)
- **Runnable-.exe smoke-test** (was §4) — auto-runs after a successful
  Win64 cook, confirms the staged game process survives a fixed observe
  window, and records the verdict to build history. Commit `26dfc53`.
  (`src/lib/packaging/smoke-test.ts`, `/api/packaging/smoke-test`,
  `SmokeTest.tsx`.)

Section numbers below are kept stable so cross-references elsewhere still
resolve; the gaps (§1, §4) are the shipped items above.

## Still planned

### 2. `cook-executor` keeps a structured log

The current `cook-executor` streams progress to `CookProgress` and
captures stderr in the error message. Extend: emit a structured per-phase
log (`{phase, ts, lines: []}`), persisted to
`<UE>/Saved/Logs/PoF-CookExecutor-<ts>.jsonl`. The
`BuildHistoryDashboard` reads + renders these per build — the operator
can drill into "phase X started at T, took Y seconds, emitted these
warnings." Replaces the current "last 2 KB of output excerpt" with
structured navigation.

### 3. Multi-platform build profiles

Today profiles default to Win64 Shipping. Add presets for:

- **Win64 Development** — debug-friendly, faster cook, full logging
  (`bUseLoggingInShipping` irrelevant).
- **Win64 Shipping** — the current default.
- **Linux Shipping** — needs the Linux cross-compile toolchain (clang);
  PoF flags whether it's installed (`UE_SDKS_ROOT`) and either dispatches
  or instructs the user.
- **Android Quick** — packaging-config + warnings for Android requirements.

The platform notes (`uat-command-generator.ts` `PLATFORM_NOTES`)
already exist; surface them in the UI as a panel under each profile.

### 5. `cmd.exe` quoting gotcha in the platform-notes UI

A small README on the cook-executor — every dev who maintains it needs
to know the `windowsVerbatimArguments + outer-quote-wrap` requirement.
Inline comment in `cook-executor.ts` already says this; add a one-line
prompt-knowledge entry to the gotchas pack
([[../01-generation-quality/pof-app.md]] §3) so generated build scripts
elsewhere never repeat it.

### 6. Surface `.uproject` plugin enablement in PoF

The Characters sub-project required enabling `MoverTests` — a manual
edit to `PoF.uproject`. Build a small `src/components/modules/project-
setup/PluginsPanel.tsx` that lists the project's enabled plugins (parsed
from `.uproject`), shows the engine's available plugins
(`<Engine>/Plugins/**/*.uplugin`), and lets the operator toggle. Avoids
the "hand-edit JSON" step.

## Verification this work succeeded

- The build-history dashboard shows per-phase structured logs for a
  recent cook. (§2)
- A Win64 Development profile cooks successfully and produces a runnable
  exe with logs, verifying the platform-config dropdown works. (§3)

## Proposed next development directions

These build on the now-shipped pre-flight gate + smoke-test foundation.

### A. One "build-pipeline health" harness pass

The two e2e specs in [[tests.md]] (`packaging-e2e.spec.ts`,
`packaging-failure-modes.spec.ts`) now have real targets. Wire them into
a single harness gate: **pre-flight green → cook → smoke-test pass** as
one cohesive "the build pipeline is healthy" check, plus a failure-mode
spec that seeds a blank `ProjectID` and asserts pre-flight catches it
*before* a cook even starts. Collapses the old separate SP-C (cook) and
SP-E (smoke) dispatches into one.

### B. Extend the pre-flight static audit to the `Target.cs` defect class

Config-sanity covers ProjectID / map / game-mode; the WITH_EDITOR audit
covers editor-only APIs in Runtime modules. Neither yet catches the
`TargetBuildEnvironment.Unique` / missing `bOverrideBuildEnvironment =
true` on an installed engine — the RulesError that cost SP-C a cook. Add
a `Source/*.Target.cs` parser to the fast checks that flags it. Pure and
testable, the same shape as `auditWithEditor` — extends
`src/lib/packaging/preflight.ts` rather than adding a subsystem.

### C. Persist the pre-flight verdict alongside each cook

Pre-flight status is currently ephemeral UI state. Record it (green /
overridden / which checks failed) into the build-history row, the same
way the smoke-test note is now stored. The dashboard can then
distinguish "cooked clean" from "cooked with an override," and a
creeping build-config regression shows up as a trend rather than a
one-off surprise.

### D. Deepen the smoke-test from process-survival to gameplay self-check

The smoke-test confirms the process *survives*; it does not confirm the
game *works*. Launch the staged exe with
`-ExecCmds="ARPG.Verify.Slice;Quit"` (paired with the console command in
[[game.md]] §6) so the cooked build runs an in-game self-check and exits
0 on success. Bridges the process-level signal (shipped) and the
PIE-level functional test for the packaged path.

### E. Headless pre-flight + build-verify for CI

Both pre-flight and the smoke-test now have API routes, but they assume
the PoF dev server is up. Expose the same logic as a standalone CLI entry
(or harness helper) so a push to the UE repo can gate on "pre-flight
green + Shipping build-verify pass" headlessly — wiring the cheap
defenses into the same automation that runs the functional tests, with
no app instance required.
