# 07 · Packaging & Build — Game Improvements

## Goals

Reduce the UE-project-side defect surface that the packaging pipeline
keeps surfacing. Close known WITH_EDITOR violations in the bridge plugin,
keep build-config (Target.cs, .ini) clean, and make the build reproducible
on a fresh machine.

## Improvements

### 1. Audit `WITH_EDITOR` across the bridge plugin's runtime module

SP-C fixed one unguarded `FEditorDelegates::PostPIEStarted.RemoveAll(this)`
call in `PofTestRunner.cpp`. The `PillarsOfFortuneBridge` runtime module
likely has more — every `Editor.h` include or `FEditorDelegates` /
`GEditor` / `FAssetTools` call needs an explicit `#if WITH_EDITOR` guard
or it must move to the editor module.

A one-time sweep:
- `grep -rl 'FEditorDelegates\|GEditor\|EditorAssetLibrary\|FAssetTools' Plugins/PillarsOfFortuneBridge/Source/PillarsOfFortuneBridge`
- For each hit: add `#if WITH_EDITOR` / `#endif` or migrate to
  `PillarsOfFortuneBridgeEditor`.
- Run a Win64 Shipping build to confirm clean. The
  `UAnimAssetCommandlet`, `MixamoImportCommandlet`, etc. should not be
  in a runtime module.

Long-term: have `PillarsOfFortuneBridge` (Runtime) stop depending on
`UnrealEd` entirely; if PoF's bridge needs editor APIs, they belong in
the Editor module.

### 2. Lock down `PoF.Target.cs` decisions

The Target.cs currently has `bOverrideBuildEnvironment = true` for the
Shipping target. Document the rationale with a comment explaining: "We
add `POF_SHIPPING` and `UE_BUILD_SHIPPING_WITH_EDITOR` globally; with an
installed engine this requires bOverrideBuildEnvironment. If the project
ever moves to a from-source engine, swap to `BuildEnvironment =
TargetBuildEnvironment.Unique;`." Stops a future regression where
someone reverts the override.

Similarly, `bUseLoggingInShipping = false` is deliberate — comment it
("logging disabled in Shipping; smoke-tests must use `tasklist`, not
log content").

### 3. A `Plugins/` audit on first launch

Add a small editor-startup C++ check (in `PoFEditorModule::StartupModule`)
that warns if any project plugin's `.uplugin` declares a `Runtime` module
that links against editor-only modules (`UnrealEd`, `AssetTools`, etc.).
The plugin-list parse is cheap; the warning surfaces violations before
they bite a cook.

### 4. A repeatable build manifest

Add `<UE>/build-info.json` (generated, gitignored) recording the last
successful cook: engine version, plugin list, `Target.cs` settings,
git SHA of the UE repo. Surfaced in `BuildHistoryDashboard`. Useful for
"why did the cook break this morning?" — diff against the previous good
manifest.

### 5. CI script that mirrors the packaging pipeline

A `BuildPackage.bat` already exists in the UE project; PS-2 confirmed it
runs RunUAT. Extend it (or add a `BuildPackage.sh` for Linux paths) to
match what `cook-executor` does: pre-flight build-verify on both targets,
sanity-check the .ini, run the cook, smoke-test the exe. The same script
that runs in CI; the same logic that runs from PoF. Reduces the surface
where the two diverge.

### 6. Move generated `.uasset` content registries to LFS-tracked paths

PS-3's textures + the arena's `SM_Arena` + `T_*` textures are all on
LFS (the UE `.gitattributes` covers them). Make this explicit for any
future generation pass — the generation prompts must use the
`/Game/`-rooted paths the LFS rules cover. Trivial; saves a future
"why is git pushing 50 MB of textures into the regular history" bug.

## Verification this work succeeded

- A clean `grep` of `FEditorDelegates` / `GEditor` in any plugin
  Runtime module returns zero unguarded hits.
- A fresh Win64 Shipping cook on a clean checkout (no Intermediate)
  succeeds end-to-end without manual config touchups.
- The build-info manifest is generated and diff-able across cook runs.
- The `BuildPackage.bat` runs through the same pre-flight + smoke-test
  steps as the PoF cook UI.
