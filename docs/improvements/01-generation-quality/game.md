# 01 · Generation Quality — Game Improvements

Generation-quality is fundamentally a PoF-app concern (`pof-app.md`). The
**game-side** complement is a small set of conventions and helpers that make
PoF's generated code *easier to produce correctly*. None of this is required
gameplay — these are scaffolding that future generation can lean on.

## 1. A `UARPGCharacterBase::DefaultAbilities` pattern, generalised

PS-1 added `TArray<TSubclassOf<UGameplayAbility>> DefaultAbilities` granted on
`PossessedBy` to close the "player never granted any ability" gap. The same
shape would help every future system that needs to grant something on
possession: companion components, gameplay effects, default Input Mapping
Contexts. Extract a small `IARPGDefaultsProvider` interface (or a generic
`DefaultsComponent`) that `ARPGCharacterBase::PossessedBy` consults — so
future generation can wire a feature by appending one entry to a
`Defaults*` array, never by editing `PossessedBy` directly.

## 2. A pure-C++ widget convention next to `UBossHealthBarWidget`

`UBossHealthBarWidget` proved the no-WBP pattern. The HUD sub-project's
`UVSHUDWidget` re-invented it. Promote the pattern: a
`Source/PoF/UI/ARPGCodeWidgetBase.h` minimal class — a `UUserWidget` with a
virtual `BuildTree()` called from `RebuildWidget()`, a small toolbox of
helpers for the common layout (CanvasPanel + ProgressBar + TextBlock +
Border with a styled brush). Future "give me a HUD/overlay" generation
inherits this base and only fills in `BuildTree()`. Zero WBPs needed
anywhere.

## 3. Empty content shells become **stubs**, not lies

`Content/Characters/Player/Animations/*.uasset` (the empty `BS_Locomotion`,
`AM_MeleeCombo`, …) and the missing `IMC_Default` lied to anyone who
discovered them — the asset exists, looks valid, but has no data. Two
options for handling this consistently:

- **Delete shells** that the `AnimAssetCommandlet` produced empty, and have
  it instead error loudly. The commandlet should either produce a usable
  asset (real data) or no asset at all.
- **Tag stubs** — if shells are kept on purpose, add a `Description` /
  `AssetUserData` marker (e.g. `EmptyShell=true`) that PoF can detect during
  scan + flag in the feature matrix.

The PS-1 inventory had to *infer* the assets were empty by absence of a
skeleton; an explicit marker would have saved a sub-project of confusion.

## 4. Move `UE_LOG` lifecycle markers to a shared header

`AVSHUD::BeginPlay`'s `[VSHUD]` log was the single thing that confirmed the
HUD actor was alive when its bars weren't visible. PS-1's
`GA_MeleeAttack` similarly leaned on `[GA_MeleeAttack]` logs to diagnose the
montage cancel race. Standardise: a `Source/PoF/Logging/ARPGLifecycleLog.h`
with macros like `ARPG_LIFECYCLE_LOG(Category, Format, ...)` that every
generated `BeginPlay`/`PossessedBy`/`Bind*` calls. Then any future
"why didn't this run" diagnosis starts with a grep of `LogARPGLifecycle` in
the live log.

## 5. A small `WITH_EDITOR` audit pass for the bridge plugin

`PofTestRunner.cpp` had one unguarded `FEditorDelegates` call in a Runtime
module — caught only when SP-C cooked a Shipping build. The
`PillarsOfFortuneBridge` plugin's runtime module deserves a one-time audit
of every editor-only API it touches, with `#if WITH_EDITOR` guards on each
or — cleaner — move the editor-only logic into the
`PillarsOfFortuneBridgeEditor` editor module entirely.

## 6. A self-check console command per system

The pattern PS-1's `AVSFunctionalTest` proved (real game-state assertions in
the engine) generalises to a `ARPG.SelfCheck.<System>` console command per
generated system — invoked from a dev shortcut, prints
`PASS`/`FAIL` + the reason. Cheap, runs anywhere, doesn't need the harness.
First targets: combat (`ARPG.SelfCheck.Combat` — verifies an ability is
granted, activates, applies damage on a test dummy), loot
(`ARPG.SelfCheck.Loot` — verifies the death chain drops an `ARPGWorldItem`).

## What this is *not*

This folder is **not** the place to add new gameplay systems or content. The
character / combat / HUD sub-projects own those. This file is conventions
that make the *next* generation pass produce wired-out-of-the-box code.
