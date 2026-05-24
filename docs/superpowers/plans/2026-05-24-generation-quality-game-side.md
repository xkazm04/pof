# Generation-Quality (§01) Game-Side — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the small, verified *deltas* in the game-side conventions of `docs/improvements/01-generation-quality/game.md` + `tests.md` — generalising the defaults pattern, migrating the last legacy widget onto the existing code-widget base, adding a lifecycle log + a loot self-check + a shell marker, recording a WITH_EDITOR audit, and adding the missing tests — without rebuilding the parts the per-system sub-projects already shipped.

**Architecture:** Most of game.md §1–6 already exists in the UE repo (verified 2026-05-24 — see the spec's ground-truth table). Each task therefore **begins by re-verifying current state and skips if already satisfied**, then implements only the delta. UE C++ changes land in the separate UE repo; the two app-repo test items land here. Tests are UE `AFunctionalTest` subclasses (via `AARPGFunctionalTestBase`) and shipping-safe `ARPG.Verify.*` console commands, run in PIE.

**Tech Stack:** UE5.7 C++ (GameplayAbilities, UMG, EnhancedInput, FunctionalTesting); the PoF app repo uses TypeScript/Playwright for the two app-side test items.

**Spec:** `docs/superpowers/specs/2026-05-24-generation-quality-game-side-design.md`

**Repos:**
- **UE game repo** (Tasks 1–7): `C:\Users\kazda\Documents\Unreal Projects\PoF` — remote `github.com/xkazm04/pof-exp`, branch `main`. Pushes allowed.
- **PoF app repo** (Tasks 8–9): this repo (`C:\Users\kazda\kiro\pof`) — commit locally only, user pushes manually.

**Conventions:**
- **Shared multi-session UE tree:** re-read every file before editing; `git add` only the files you changed; never `git add -A`. Run editor/tests with a unique `-abslog=<task>.log` (the shared `PoF.log` is clobbered by concurrent sessions). Commit narrowly with the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- **Cannot compile UE C++ from the app session** — execute these in a UE-capable session with the engine installed. The "run" steps assume a build is available (e.g. `Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"`).
- UE log categories live in `Source/PoF/Debug/ARPGLogCategories.h/.cpp`. Console commands use `FAutoConsoleCommandWithWorld` (survives Shipping). Pure-C++ widgets extend `UARPGCodeWidgetBase` and override `BuildTree()` — never build in `NativeConstruct()`.
- UE5.7 FBX import is via Interchange — prefer `UnrealEditor.exe -ExecutePythonScript=` over `-run=pythonscript`.

---

## File Structure

| File | Repo | Responsibility |
|---|---|---|
| `Source/PoF/Character/IARPGDefaultsProvider.h` | UE | **New.** UINTERFACE declaring the defaults a character applies on possession. |
| `Source/PoF/Character/ARPGCharacterBase.h/.cpp` | UE | **Modify.** Implement the interface; `PossessedBy` consults it (abilities loop already exists; add effects + input-context arrays). |
| `Source/PoF/Test/Character/ARPGDefaultsFunctionalTest.h/.cpp` | UE | **New.** Possesses a character, asserts each `GetDefaultAbilities()` entry is granted. |
| `Source/PoF/UI/BossHealthBarWidget.h/.cpp` | UE | **Modify.** Reparent to `UARPGCodeWidgetBase`; move `BuildWidget()` into `BuildTree()`; drop the `NativeConstruct` build. |
| `Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp` | UE | **Modify.** Add a `BossHealthBarStructure` phase asserting the migrated widget's tree. |
| `Source/PoF/Debug/ARPGLogCategories.h/.cpp` | UE | **Modify.** Add `LogARPGLifecycle`. |
| `Source/PoF/Debug/ARPGLifecycleLog.h` | UE | **New.** `ARPG_LIFECYCLE_LOG(Verbosity, Format, ...)` macro. |
| `Source/PoF/Debug/ARPGVerifyCommands.cpp` | UE | **Modify.** Add `ARPG.Verify.Loot`; add it to the `Slice` aggregate; add `ARPG.Verify.All` registry-iteration command. |
| `Source/PoFEditor/ARPGAssetShellMarker.h/.cpp` | UE | **New.** `UAssetUserData` marker (`bEmptyShell` + `Reason`) + `IsEmptyShell()` reader. |
| `Source/PoFEditor/AnimAssetCommandlet.cpp` | UE | **Modify.** Validate each produced asset; attach the marker / fail-loud on degenerate output. |
| `Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md` | UE | **New.** Recorded audit of the runtime module's editor-only API usage. |
| `e2e/helpers/harness-mode.ts` | app | **Modify.** Register the opt-in live `wiring-smoke` mode. |
| `e2e/wiring-smoke-live.spec.ts` | app | **New.** Opt-in Playwright spec for the live mode. |
| `docs/improvements/01-generation-quality/gemini-recognize-plumbing-spec.md` | app | **New.** Spec for the gemini plumbing test (no code until the CLI exists). |

---

## Task 0: Re-verify ground truth (read-only)

The tree is shared and may have moved since 2026-05-24. Confirm the spec's table before editing.

- [ ] **Step 1: Confirm each anchor still exists**

Run (read-only), from the UE repo root:
```bash
grep -rn "DefaultAbilities" Source/PoF/Character/ARPGCharacterBase.h
grep -rn "RebuildWidget\|BuildTree" Source/PoF/UI/ARPGCodeWidgetBase.h
grep -rn "NativeConstruct\|BuildWidget" Source/PoF/UI/BossHealthBarWidget.cpp
grep -rn "DECLARE_LOG_CATEGORY_EXTERN" Source/PoF/Debug/ARPGLogCategories.h
grep -rn "ARPG.Verify" Source/PoF/Debug/ARPGVerifyCommands.cpp
```
Expected: matches as described in the spec's ground-truth table. If any item is now already
implemented (e.g. someone added `ARPG.Verify.Loot`), mark that task done and skip it.

- [ ] **Step 2: No commit** (read-only).

---

## Task 1: §1 — `IARPGDefaultsProvider` + generalised `PossessedBy` (+ test #2)

**Files:**
- Create: `Source/PoF/Character/IARPGDefaultsProvider.h`
- Modify: `Source/PoF/Character/ARPGCharacterBase.h`, `Source/PoF/Character/ARPGCharacterBase.cpp`
- Test: `Source/PoF/Test/Character/ARPGDefaultsFunctionalTest.h/.cpp`

- [ ] **Step 1: Create the interface**

Create `Source/PoF/Character/IARPGDefaultsProvider.h`:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "IARPGDefaultsProvider.generated.h"

class UGameplayAbility;
class UGameplayEffect;
class UInputMappingContext;

/** An IMC the actor wants added to the Enhanced Input subsystem on possession. */
USTRUCT(BlueprintType)
struct FARPGDefaultInputContext
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputMappingContext> Context = nullptr;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    int32 Priority = 0;
};

UINTERFACE(MinimalAPI, BlueprintType)
class UARPGDefaultsProvider : public UInterface { GENERATED_BODY() };

/**
 * Declares the defaults a possessed actor applies on PossessedBy. A new system is
 * wired by appending an entry to one of these arrays — never by editing PossessedBy.
 */
class IARPGDefaultsProvider
{
    GENERATED_BODY()
public:
    virtual const TArray<TSubclassOf<UGameplayAbility>>& GetDefaultAbilities() const = 0;
    virtual const TArray<TSubclassOf<UGameplayEffect>>& GetDefaultEffects() const = 0;
    virtual const TArray<FARPGDefaultInputContext>& GetDefaultInputContexts() const = 0;
};
```

- [ ] **Step 2: Declare the implementation on the character**

In `Source/PoF/Character/ARPGCharacterBase.h`: add `#include "IARPGDefaultsProvider.h"`, add
`public IARPGDefaultsProvider` to the class bases, declare the three overrides, and add the two new
arrays next to the existing `DefaultAbilities` (≈ the `Abilities` category block):
```cpp
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities")
    TArray<TSubclassOf<UGameplayEffect>> DefaultEffects;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
    TArray<FARPGDefaultInputContext> DefaultInputContexts;

public:
    virtual const TArray<TSubclassOf<UGameplayAbility>>& GetDefaultAbilities() const override { return DefaultAbilities; }
    virtual const TArray<TSubclassOf<UGameplayEffect>>& GetDefaultEffects() const override { return DefaultEffects; }
    virtual const TArray<FARPGDefaultInputContext>& GetDefaultInputContexts() const override { return DefaultInputContexts; }
```

- [ ] **Step 3: Apply defaults via the interface in `PossessedBy`**

In `Source/PoF/Character/ARPGCharacterBase.cpp`, inside the existing `HasAuthority()` block of
`PossessedBy` (which already loops `DefaultAbilities`), change the loop source to the interface and add
the effects loop immediately after:
```cpp
    if (HasAuthority())
    {
        for (const TSubclassOf<UGameplayAbility>& AbilityClass : GetDefaultAbilities())
        {
            if (AbilityClass)
            {
                AbilitySystemComponent->GiveAbility(FGameplayAbilitySpec(AbilityClass, 1, INDEX_NONE, this));
            }
        }
        for (const TSubclassOf<UGameplayEffect>& EffectClass : GetDefaultEffects())
        {
            if (EffectClass)
            {
                FGameplayEffectContextHandle Ctx = AbilitySystemComponent->MakeEffectContext();
                Ctx.AddSourceObject(this);
                const FGameplayEffectSpecHandle Spec = AbilitySystemComponent->MakeOutgoingSpec(EffectClass, 1.f, Ctx);
                if (Spec.IsValid()) { AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get()); }
            }
        }
    }
```
Leave IMC handling to the existing input setup; have it read `GetDefaultInputContexts()` where it
currently adds the player IMC (do not add a second add-site).

- [ ] **Step 4: Write the smoke test (#2)**

Create `Source/PoF/Test/Character/ARPGDefaultsFunctionalTest.h/.cpp` as an `AARPGFunctionalTestBase`
subclass with one phase `AbilitiesGranted`: spawn an `AARPGCharacterBase`, possess it with a transient
`AController`, then for each `GetDefaultAbilities()` entry assert the ASC has a matching granted
`FGameplayAbilitySpec` (`AbilitySystemComponent->FindAbilitySpecFromClass(Entry)` non-null). Return
`Advance`/`Fail` accordingly. (Mirror the existing `AVSHUDFunctionalTest` structure; reuse the base's
`WaitForCondition` if possession is async.)

- [ ] **Step 5: Build + run the test**

Run (UE-capable session):
```
Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"
UnrealEditor-Cmd.exe "...\PoF.uproject" -ExecCmds="Automation RunTests ARPGDefaults; Quit" -unattended -nullrhi -abslog=task1.log
```
Expected: the `ARPGDefaults` functional test reports success; build has no errors.

- [ ] **Step 6: Commit** (UE repo)
```bash
git add Source/PoF/Character/IARPGDefaultsProvider.h Source/PoF/Character/ARPGCharacterBase.h Source/PoF/Character/ARPGCharacterBase.cpp Source/PoF/Test/Character/ARPGDefaultsFunctionalTest.h Source/PoF/Test/Character/ARPGDefaultsFunctionalTest.cpp
git commit -m "feat(character): IARPGDefaultsProvider — wire features by array, not by editing PossessedBy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: §2 — Migrate `BossHealthBarWidget` onto `UARPGCodeWidgetBase` (+ test #1)

**Files:**
- Modify: `Source/PoF/UI/BossHealthBarWidget.h`, `Source/PoF/UI/BossHealthBarWidget.cpp`
- Modify: `Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp`

- [ ] **Step 1: Reparent the header**

In `Source/PoF/UI/BossHealthBarWidget.h`: replace `public UUserWidget` with `public UARPGCodeWidgetBase`
(add `#include "ARPGCodeWidgetBase.h"`). Replace the `BuildWidget()` declaration with
`virtual void BuildTree() override;`. Remove the `NativeConstruct()` override declaration if its only
job was to call `BuildWidget()`.

- [ ] **Step 2: Move the body into `BuildTree`**

In `Source/PoF/UI/BossHealthBarWidget.cpp`: rename `BuildWidget()` → `BuildTree()`, delete the
`NativeConstruct()` override (or strip it to `Super::NativeConstruct()` if it does other work), and
replace the hand-rolled `UProgressBar` construction + styling with
`HealthBar = CreateStyledProgressBar(FName(TEXT("BossHealthBar")), <fill colour>);`. Keep the existing
VerticalBox/TextBlock layout. Do not change public setters (`SetHealthPercent`, etc.).

- [ ] **Step 3: Add the structure test phase (#1)**

In `Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp` (or a new sibling test if cleaner): add a
`BossHealthBarStructure` phase that `CreateWidget<UBossHealthBarWidget>`, adds it to the viewport, and
asserts `GetRootWidget()`/`WidgetTree` contains the expected named children (the ProgressBar by the
name used in Step 2). Fail if the root is null (the `NativeConstruct`-vs-`RebuildWidget` regression).

- [ ] **Step 4: Build + run**
```
Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"
UnrealEditor-Cmd.exe "...\PoF.uproject" -ExecCmds="Automation RunTests VSHUD; Quit" -unattended -abslog=task2.log
```
Expected: build clean; the HUD structure test (incl. the new Boss phase) passes. (Needs RHI for widget
construction — omit `-nullrhi` here, or guard the viewport-add under `GEngine->GameViewport`.)

- [ ] **Step 5: Commit** (UE repo)
```bash
git add Source/PoF/UI/BossHealthBarWidget.h Source/PoF/UI/BossHealthBarWidget.cpp Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp
git commit -m "refactor(ui): migrate BossHealthBarWidget onto UARPGCodeWidgetBase

Removes the last NativeConstruct-build widget; one canonical code-widget example.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: §4 — `LogARPGLifecycle` category + `ARPG_LIFECYCLE_LOG` macro

**Files:**
- Modify: `Source/PoF/Debug/ARPGLogCategories.h`, `Source/PoF/Debug/ARPGLogCategories.cpp`
- Create: `Source/PoF/Debug/ARPGLifecycleLog.h`
- Modify: `Source/PoF/AbilitySystem/GA_MeleeAttack.cpp`, `Source/PoF/UI/VSHUD.cpp` (marker migration)

- [ ] **Step 1: Add the category**

In `ARPGLogCategories.h` add `DECLARE_LOG_CATEGORY_EXTERN(LogARPGLifecycle, Log, All);` to the list; in
`ARPGLogCategories.cpp` add the matching `DEFINE_LOG_CATEGORY(LogARPGLifecycle);`.

- [ ] **Step 2: Create the macro header**

Create `Source/PoF/Debug/ARPGLifecycleLog.h`:
```cpp
#pragma once

#include "ARPGLogCategories.h"

/**
 * Lifecycle marker — logs the calling function name to a greppable category.
 * Use only at lifecycle edges (BeginPlay / PossessedBy / Bind*), so "why didn't
 * this run" diagnosis is `grep LogARPGLifecycle` in the live log.
 */
#define ARPG_LIFECYCLE_LOG(Verbosity, Format, ...) \
    UE_LOG(LogARPGLifecycle, Verbosity, TEXT("[%s] " Format), *FString(__FUNCTION__), ##__VA_ARGS__)
```

- [ ] **Step 3: Migrate the existing markers**

Replace the `UE_LOG(LogTemp, ..., TEXT("[GA_MeleeAttack] ..."))` lifecycle lines in
`GA_MeleeAttack.cpp` and any `[VSHUD]` lifecycle lines in `VSHUD.cpp`/`VSHUDWidget.cpp` with
`ARPG_LIFECYCLE_LOG(Log, "...")` (drop the now-redundant `[Tag]` prefix — the macro adds
`[__FUNCTION__]`). **Only** convert lifecycle markers (came-alive / possessed / bound), not every log.

- [ ] **Step 4: Build + grep verify**
```
Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"
UnrealEditor-Cmd.exe "...\PoF.uproject" -ExecCmds="ARPG.Verify.Slice; Quit" -unattended -abslog=task3.log
grep "LogARPGLifecycle" task3.log
```
Expected: build clean; `task3.log` contains `LogARPGLifecycle` lines from the BeginPlay/PossessedBy
paths exercised by the slice.

- [ ] **Step 5: Commit** (UE repo)
```bash
git add Source/PoF/Debug/ARPGLogCategories.h Source/PoF/Debug/ARPGLogCategories.cpp Source/PoF/Debug/ARPGLifecycleLog.h Source/PoF/AbilitySystem/GA_MeleeAttack.cpp Source/PoF/UI/VSHUD.cpp
git commit -m "feat(debug): LogARPGLifecycle category + ARPG_LIFECYCLE_LOG marker macro

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: §6 — `ARPG.Verify.Loot` (+ add to `Slice` aggregate)

**Files:**
- Modify: `Source/PoF/Debug/ARPGVerifyCommands.cpp`

- [ ] **Step 1: Add the loot check**

In `ARPGVerifyCommands.cpp`, alongside the existing `GVerify*` registrations, add:
```cpp
static FAutoConsoleCommandWithWorld GVerifyLoot(
    TEXT("ARPG.Verify.Loot"),
    TEXT("Drive an AARPGEnemyCharacter's death and verify an ARPGWorldItem drops. Logs ARPG.Verify.Loot: PASS/FAIL."),
    FConsoleCommandWithWorldDelegate::CreateStatic(&VerifyLoot));
```
and implement `static void VerifyLoot(UWorld* World)`: find (or spawn) an `AARPGEnemyCharacter` — the
loot component binds `OnEnemyDeath` *specifically* on the enemy class, **not** a test dummy (per the
§01 README finding) — apply lethal damage through the real GAS damage path (reuse the helper
`VerifyCombat` uses), then within a short poll window count `AARPGWorldItem` actors via
`TActorIterator`. Log `ARPG.Verify.Loot: PASS`/`FAIL <reason>` to the same category the other verify
commands use.

- [ ] **Step 2: Add it to the Slice aggregate**

In `VerifySlice` (the body behind `ARPG.Verify.Slice`), call `VerifyLoot(World)` and fold its verdict
into the aggregate PASS/FAIL.

- [ ] **Step 3: Build + run**
```
Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"
UnrealEditor-Cmd.exe "...\PoF.uproject" -ExecCmds="ARPG.Verify.Loot; Quit" -unattended -abslog=task4.log
grep "ARPG.Verify.Loot:" task4.log
```
Expected: `ARPG.Verify.Loot: PASS` (in a level with an enemy + loot table wired).

- [ ] **Step 4: Commit** (UE repo)
```bash
git add Source/PoF/Debug/ARPGVerifyCommands.cpp
git commit -m "feat(debug): ARPG.Verify.Loot self-check (death chain drops ARPGWorldItem)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: §3 — Empty-shell marker + fail-loud commandlet

**Decision point:** implement the `AssetUserData` marker (preferred — keeps shells but makes them
detectable) **or** the delete-on-empty fallback (commandlet errors + skips). Do not leave a silent
empty asset. Steps below are for the marker.

**Files:**
- Create: `Source/PoFEditor/ARPGAssetShellMarker.h`, `Source/PoFEditor/ARPGAssetShellMarker.cpp`
- Modify: `Source/PoFEditor/AnimAssetCommandlet.cpp`

- [ ] **Step 1: Create the marker**

Create `Source/PoFEditor/ARPGAssetShellMarker.h`:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Engine/AssetUserData.h"
#include "ARPGAssetShellMarker.generated.h"

/** Attached by content-generation commandlets so PoF's scan can flag a not-yet-filled asset. */
UCLASS()
class UARPGAssetShellMarker : public UAssetUserData
{
    GENERATED_BODY()
public:
    UPROPERTY() bool bEmptyShell = false;
    UPROPERTY() FString Reason;
};

/** True when Object carries a shell marker flagged empty. */
POFEDITOR_API bool IsEmptyShell(const UObject* Object);
```
Implement `IsEmptyShell` in the `.cpp` by querying `IInterface_AssetUserData::GetAssetUserDataOfClass`.

- [ ] **Step 2: Validate + mark in the commandlet**

In `AnimAssetCommandlet.cpp`, after constructing each asset, assert its expected data (montage has
≥1 section; blendspace has samples; curve table has rows). On failure: `UE_LOG(..., Error, ...)`, attach
a marker with `bEmptyShell=true` + the reason, and **do not save** the degenerate asset (or, fallback,
delete it). On success: attach a marker with `bEmptyShell=false`.

- [ ] **Step 3: Run the commandlet + verify**
```
UnrealEditor-Cmd.exe "...\PoF.uproject" -run=AnimAsset -SpeedMax=900 -UseSpeedRatio -abslog=task5.log
grep -i "EmptyShell\|Error" task5.log
```
Expected: all assets produced with `bEmptyShell=false`; no degenerate asset saved.

- [ ] **Step 4: Commit** (UE repo)
```bash
git add Source/PoFEditor/ARPGAssetShellMarker.h Source/PoFEditor/ARPGAssetShellMarker.cpp Source/PoFEditor/AnimAssetCommandlet.cpp
git commit -m "feat(editor): empty-shell marker + fail-loud AnimAssetCommandlet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: §5 — Recorded WITH_EDITOR audit of the bridge runtime module

**Files:**
- Create: `Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md`
- Modify (only if the audit finds an unguarded call): the offending runtime `.cpp`.

- [ ] **Step 1: Enumerate editor-only usage**

From the bridge runtime module dir, list every editor-only symbol:
```bash
grep -rn "FEditorDelegates\|GEditor\|UnrealEd\|FAssetRegistryModule\|GIsEditor\|WITH_EDITOR" \
  Plugins/PillarsOfFortuneBridge/Source/PillarsOfFortuneBridge/
```

- [ ] **Step 2: For each hit, confirm guard / fix / relocate**

For each result: confirm it is inside `#if WITH_EDITOR`, OR add the guard, OR move the logic into the
`PillarsOfFortuneBridgeEditor` module. Record every site (file:line, symbol, disposition) in
`Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md`.

- [ ] **Step 3: Prove it with a Shipping compile of the runtime module**
```
Build.bat PoF Win64 Shipping -Project="...\PoF.uproject" -abslog=task6.log
```
Expected: compiles with no editor-only symbol error. Record the result + date in the audit doc.

- [ ] **Step 4: Commit** (UE repo)
```bash
git add Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md
# plus any guarded .cpp the audit fixed
git commit -m "docs(bridge): recorded WITH_EDITOR audit of the runtime module (Shipping-clean)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: tests #3 — Iterate every `ARPG.Verify.*`

**Files:**
- Modify: `Source/PoF/Debug/ARPGVerifyCommands.cpp`

- [ ] **Step 1: Make the verify lambdas a small registry**

Refactor the per-command functions into a static array of `{ FName Name; TFunction<bool(UWorld*)> Run; }`
(each returns PASS=true). The existing `ARPG.Verify.X` commands call their entry; a new
`ARPG.Verify.All` iterates the array, runs each, logs `ARPG.Verify.All: PASS` only if all pass, else
`FAIL` with the names that failed. This way a future `ARPG.Verify.Y` auto-joins by adding one array
entry.

- [ ] **Step 2: Build + run**
```
Build.bat PoFEditor Win64 Development -Project="...\PoF.uproject"
UnrealEditor-Cmd.exe "...\PoF.uproject" -ExecCmds="ARPG.Verify.All; Quit" -unattended -abslog=task7.log
grep "ARPG.Verify.All:" task7.log
```
Expected: `ARPG.Verify.All: PASS` in a fully-wired slice level.

- [ ] **Step 3: Commit** (UE repo)
```bash
git add Source/PoF/Debug/ARPGVerifyCommands.cpp
git commit -m "test(debug): ARPG.Verify.All iterates every self-check command

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: (app repo) Live `HARNESS_MODE=wiring-smoke` mode

**Files:**
- Modify: `e2e/helpers/harness-mode.ts` (register the mode)
- Create: `e2e/wiring-smoke-live.spec.ts`

This is the **live** counterpart to the deterministic `src/__tests__/registry/wiring-smoke.test.ts`. It
is opt-in (needs a running dev server + the Claude CLI) and is **not** part of `npm run validate`.

- [ ] **Step 1: Read the existing mode registry**

Read `e2e/helpers/harness-mode.ts` to match the existing mode-registration shape and the
`HARNESS_MODE` env switch.

- [ ] **Step 2: Register `wiring-smoke`**

Add a `wiring-smoke` mode whose runner, for each module in `SUB_MODULE_IDS`, drives a single dispatch
(reuse `e2e/helpers/single-dispatch.ts`) and asserts the dispatch's output JSON contains a discoverable
`Wiring Requirements` block. Gate it on `process.env.HARNESS_MODE === 'wiring-smoke'`.

- [ ] **Step 3: Create the spec**

Create `e2e/wiring-smoke-live.spec.ts` with a `test.skip(!process.env.HARNESS_MODE, ...)` guard so it
no-ops in normal CI, and one `test` per module behind the mode.

- [ ] **Step 4: Verify it is correctly skipped by default**

Run: `npx playwright test e2e/wiring-smoke-live.spec.ts`
Expected: all tests **skipped** (no `HARNESS_MODE`), proving the guard and that it does not run in
normal CI. (A real run requires `HARNESS_MODE=wiring-smoke` + dev server + CLI.)

- [ ] **Step 5: Commit** (app repo — local only)
```bash
git add e2e/helpers/harness-mode.ts e2e/wiring-smoke-live.spec.ts
git commit -m "test(e2e): opt-in live wiring-smoke harness mode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: (app repo) gemini-recognize plumbing spec

**Files:**
- Create: `docs/improvements/01-generation-quality/gemini-recognize-plumbing-spec.md`

`gemini-recognize.mjs` is absent from the repo — there is nothing to plumb against, so this deliverable
is a spec, not a test.

- [ ] **Step 1: Write the spec**

Create the doc describing: (a) the trigger — *when `gemini-recognize.mjs` is (re)added*, add a Playwright
e2e; (b) the test — run the CLI against a committed `e2e/fixtures/<ref>.png`, snapshot the response
shape (not pixel content), assert the documented fields (label/confidence/etc.); (c) the motivation —
the HUD/Characters/PS-3 gates depended on Gemini reads, so a silent CLI break must fail loudly; (d) a
checklist for the implementer (commit the fixture, pin the model, tolerate score drift via shape-only
snapshot).

- [ ] **Step 2: Commit** (app repo — local only)
```bash
git add docs/improvements/01-generation-quality/gemini-recognize-plumbing-spec.md
git commit -m "docs(tests): gemini-recognize plumbing spec (CLI absent — spec only)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- game.md §1 → Task 1. ✓  §2 → Task 2. ✓  §3 → Task 5. ✓  §4 → Task 3. ✓  §5 → Task 6. ✓  §6 → Task 4. ✓
- tests.md game #1 → Task 2 Step 3. ✓  #2 → Task 1 Step 4. ✓  #3 → Task 7. ✓
- tests.md e2e wiring-smoke (live) → Task 8 (deterministic stand-in already in app repo). ✓
- tests.md gemini plumbing → Task 9 (spec-only; CLI absent). ✓

**Placeholder scan:** Decision points (§3 marker-vs-delete) are explicit choices, not TODOs. Insertion
points are given by file + symbol because the executing session compiles in a tree this session cannot
(line numbers would be stale); each code step shows the complete code to add.

**Type consistency:** `IARPGDefaultsProvider::GetDefaultAbilities/Effects/InputContexts` and
`FARPGDefaultInputContext` are defined in Task 1 and referenced consistently. `UARPGCodeWidgetBase`
helpers (`CreateStyledProgressBar`, `BuildTree`) match the verified header. `ARPG_LIFECYCLE_LOG` +
`LogARPGLifecycle` defined in Task 3 are used in Tasks 3. `ARPG.Verify.Loot`/`.All` naming matches the
existing `ARPG.Verify.*` convention.

**Risk notes:** Every UE task starts with a re-verify step because the tree is shared and several items
may already be (partly) done; skip any task whose delta no longer exists. UE C++ cannot be compiled from
the PoF app session — a UE-capable session must build + run. Tasks 8–9 are the only app-repo tasks and
are non-blocking (opt-in / docs).
