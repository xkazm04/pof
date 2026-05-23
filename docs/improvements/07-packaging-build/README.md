# 07 · Packaging & Build

## Scope

The cook + package pipeline (`/api/packaging/execute` + `CookProgress`),
the UE project's `BuildCookRun` invocation, the `cook-executor` module,
the build-verify pre-flight (UnrealBuildTool), `PoF.Target.cs` build
configuration, packaging profile management, and the verification of a
runnable `.exe`.

## Current state

After SP-C + SP-E (2026-05-21):

- PoF's packaging UI (`/api/packaging/execute` + `CookProgress` + the
  build-history dashboard) is functional. The cook is driven by
  `cook-executor.ts` spawning `cmd.exe /c "<RunUAT.bat command>"` with
  `windowsVerbatimArguments: true` AND an outer-quote wrap (both required
  — neither alone is sufficient).
- `cook-executor` captures both stdout and stderr (the latter previously
  discarded, surfacing failures undiagnosably). The exe path is derived
  from RunUAT's "Cleaning Stage Directory" log line + the project name,
  since RunUAT never prints a "Staged executable:" line directly.
- The UE project's `PoF.Target.cs` Shipping target has
  `bOverrideBuildEnvironment = true` — required because the target adds
  custom `GlobalDefinitions` (`POF_SHIPPING`, `UE_BUILD_SHIPPING_WITH_EDITOR`)
  and an installed engine cannot use `TargetBuildEnvironment.Unique`.
- `Config/DefaultGame.ini` `ProjectID` is filled (was blank — cook
  commandlet rejects an empty ProjectID).
- `PofTestRunner.cpp` (runtime module of the PillarsOfFortuneBridge
  plugin) has its `FEditorDelegates` call `#if WITH_EDITOR` guarded —
  was an unguarded editor-only API that blocked Shipping compile.
- SP-E confirmed the packaged build launches and the real game process
  (`PoF-Win64-Shipping.exe`) survives a 25-second window. No log is
  produced because `bUseLoggingInShipping = false` is set in the Shipping
  target — expected, not a fault.

## Key lessons

1. **`cmd.exe /c` with quoted paths needs BOTH `windowsVerbatimArguments:
   true` and an outer quote wrap** — `cmd` strips outer quotes itself when
   there are >2 quote characters and the string doesn't end in one. SP-C
   hit each half of this trap on successive runs.
2. **`cook-executor` was discarding stderr.** Every cook failure surfaced
   as "exit code 1" with no detail until SP-C added the stderr drain.
   The fix is a permanent pattern: any spawned child whose stderr can
   carry diagnostic information must be drained.
3. **RunUAT does not print a "Staged executable" line** — the exe-path
   parser must derive it from "Cleaning Stage Directory" + the project
   name. The original regex assumption was wrong.
4. **A UE installed engine forbids `TargetBuildEnvironment.Unique`** —
   targets that add custom `GlobalDefinitions` either omit them (sharing
   the UnrealGame build env) or set `bOverrideBuildEnvironment = true`.
   The latter is the documented "I want to keep my custom defines on an
   installed engine" path.
5. **Shipping builds compile out logging.** SP-E expected to read the
   game's log post-launch and found none — `bUseLoggingInShipping = false`.
   The smoke-test instead checks the **process** is alive via `tasklist`.
6. **The plugin's runtime module had an unguarded editor-only API call.**
   `WITH_EDITOR`-audit is a recurring class of build defect; SP-C fixed
   one occurrence, more may lurk in other plugins.
7. **`PoF.exe` at the stage root is a bootstrap** that hands off to
   `PoF\Binaries\Win64\PoF-Win64-Shipping.exe`; the bootstrap may exit
   before the game does. The smoke-test must check the real game process
   image name, not just the spawned PID.

## Isolated-CLI session focus

A session works on:
- **PoF app:** `src/lib/packaging/cook-executor.ts`,
  `src/lib/packaging/uat-command-generator.ts`,
  `src/lib/packaging/build-profiles*.ts`,
  `src/components/modules/game-systems/PackagingView.tsx` +
  `BuildConfigSelector.tsx` + `PlatformProfileCard.tsx` + `CookProgress.tsx`
  + `BuildHistoryDashboard.tsx`, `src/app/api/packaging/`.
- **UE project:** `Source/PoF.Target.cs`, `Source/PoFEditor.Target.cs`,
  `Plugins/*/Source/*/PoF*.cpp` (the plugin's runtime modules — for
  WITH_EDITOR audits), `Config/DefaultGame.ini` / `DefaultEngine.ini`
  packaging-related settings.

It does *not* touch gameplay, characters, HUD, environment, or content
pipelines — those have their own folders. The packaging session is
narrowly focused on "does the build pipeline work, produce a runnable
`.exe`, and report failures diagnosably."
