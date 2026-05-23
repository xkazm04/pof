# 07 · Packaging & Build — PoF App Improvements

## Goals

Make the packaging pipeline (a) diagnose every failure clearly, (b) catch
the recurring build-config defect class (build environment, ProjectID,
WITH_EDITOR audit) at pre-flight time, (c) cover multiple platforms beyond
Win64 Shipping, and (d) prove the produced `.exe` is runnable
automatically.

## Improvements

### 1. A pre-flight checklist before any cook

`src/components/modules/game-systems/PackagingView.tsx` adds a
"Pre-flight" panel above the start-cook button. It runs (in order):

- **Build-verify on `PoFEditor`** — the existing pattern from SP-C's
  Part A. Catches compile errors before a 30-min cook.
- **Build-verify on the Shipping game target** — catches Shipping-specific
  errors (the `bOverrideBuildEnvironment` class, plugin-runtime
  WITH_EDITOR violations) before the cook commandlet wastes time on them.
- **Config sanity checks** — `ProjectID` non-empty, `GameDefaultMap` set,
  `GlobalDefaultGameMode` set, the selected `Map` in the cook config
  actually exists.
- **Plugin module-type audit** — flag any `Runtime` plugin module that
  references `FEditorDelegates`, `GEditor`, `FAssetTools`, etc. without
  `#if WITH_EDITOR` guards. Simple grep, large value.

Each pre-flight produces a green/red tile. Pre-flights are independently
re-runnable. A cook is blocked until pre-flights are green (or the user
explicitly overrides).

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

### 4. A "runnable .exe" smoke-test as a packaging step

SP-E ran the smoke-test as its own e2e spec; promote it to a built-in
packaging step. After a successful cook, PoF launches the staged exe
(the bootstrap path `<StageDir>/<ProjectName>.exe`), tasklist-checks
`<ProjectName>-Win64-Shipping.exe` survives 25 s, then taskkills. Result
goes into the build history alongside the cook outcome. Eliminates "cook
succeeded; nobody verified the exe runs."

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

- A cook that *would* fail on a build-config issue fails the pre-flight
  *instead* — green pre-flight ≈ green cook (modulo content errors).
- The build-history dashboard shows per-phase structured logs for a
  recent cook.
- A Win64 Development profile cooks successfully and produces a runnable
  exe with logs (verifying the platform-config dropdown works).
- The post-cook smoke-test runs automatically and reports the exe
  survived; SP-E becomes a one-line "smoke-test: ✓" in the build
  history, not its own e2e dispatch.
