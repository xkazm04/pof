# PS-1: Gray-box Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble a runnable gray-box ARPG vertical slice in the UE project and verify criteria #2–#5 (move, attack-activate, damage, death+loot) with an in-engine functional test.

**Architecture:** UE Python scripts (run headless via `UnrealEditor-Cmd`) author a level, primitive player/enemy/controller/GameMode Blueprints, an Input Mapping Context, and project config. A small C++ change closes the "no ability granted to the player" gap. A C++ `AFunctionalTest` placed in the level verifies the gameplay loop in PIE. This is exploratory integration work — SP-B's generated C++ has never run — so Task 1 is a discovery task whose findings ground Tasks 2–5.

**Tech Stack:** UE 5.7 (`unreal` Python API, `AFunctionalTest`, GAS), C++, `UnrealEditor-Cmd`, the Leonardo skill's `gemini-recognize.mjs`.

**Spec:** `docs/superpowers/specs/2026-05-22-playable-slice-ps-1-design.md`

---

## Planning-time facts (from the 2026-05-22 UE-project inventory)

UE project root: `C:\Users\kazda\Documents\Unreal Projects\PoF` (UE 5.7, not under git). Modules `PoF` (Runtime) + `PoFEditor` (Editor).

- `AARPGPlayerCharacter` : `AARPGCharacterBase` : `ACharacter`+`IAbilitySystemInterface` (Abstract). Header `Source/PoF/Player/ARPGPlayerCharacter.h`, base `Source/PoF/Character/ARPGCharacterBase.h`. ASC + `UARPGAttributeSet` created in the base ctor; `PossessedBy()` calls `InitAbilityActorInfo` then `InitializeAttributes()`. **No default-abilities array — nothing grants the player an ability.**
- Attribute init is data-driven: base has `EditDefaultsOnly` `AttributeInitTable` (UDataTable, row struct `FARPGAttributeInitRow`), `AttributeInitRowName` (FName; player default `"Player"`).
- `AARPGEnemyCharacter` : `AARPGCharacterBase`. Header `Source/PoF/Character/ARPGEnemyCharacter.h`. Has `UPROPERTY TArray<TSubclassOf<UGameplayAbility>> GrantedAbilities`, owns a `UARPGLootDropComponent LootDropComponent`, `AttributeInitRowName` (enemy rows exist, e.g. `"Skeleton"`). The loot component auto-drops only for this class.
- `AARPGGameMode` : `AGameModeBase`. Header `Source/PoF/Framework/ARPGGameMode.h`. ctor sets `DefaultPawnClass`/`PlayerControllerClass`; both overridable in a BP subclass.
- `AARPGPlayerController` — header `Source/PoF/Player/ARPGPlayerController.h`. `EditDefaultsOnly` `UInputMappingContext* DefaultMappingContext` and `UInputAction*` props incl. `IA_Move`, `IA_PrimaryAttack`. None assigned in C++. `SetupInputComponent` binds `IA_PrimaryAttack` → `HandlePrimaryAttack` → `ASC->TryActivateAbilitiesByTag({Ability.Melee.LightAttack})`.
- `UARPGAttributeSet` — header `Source/PoF/AbilitySystem/ARPGAttributeSet.h`. `Health`/`MaxHealth` (+ many more) with `ATTRIBUTE_ACCESSORS`. Delegate `OnHealthDepleted(AActor* KillingActor)`.
- `UGA_MeleeAttack` : `UARPGGameplayAbility` : `UGameplayAbility` (Abstract). Header `Source/PoF/.../GA_MeleeAttack.h`. `EditDefaultsOnly`: `AttackMontage` (UAnimMontage — `CanActivateAbility` false if null), `ComboSectionNames` (TArray<FName> — must be non-empty), `DamageEffect` (`TSubclassOf<UGameplayEffect>`), `BaseDamage`. ctor adds asset tag `Ability.Melee.LightAttack`.
- `UARPGLootDropComponent` — header `Source/PoF/Loot/ARPGLootDropComponent.h`. `LootTable` (`UARPGLootTable`), `bAutoDropOnDeath` (true), `bSliceMode` (true), gold props. `BeginPlay` binds `OnOwnerDeath` to the owner's `OnEnemyDeath` delegate (owner cast to `AARPGEnemyCharacter`).
- `AARPGWorldItem` : `AActor` — header `Source/PoF/Loot/ARPGWorldItem.h`. The dropped pickup actor.
- Input assets: only `Content/Input/Actions/IA_Move.uasset` (Axis2D) + `IA_Attack.uasset` (Boolean). **No `IMC`.**
- No maps, no skeleton/skeletal-mesh assets. `Config/DefaultEngine.ini` `[/Script/EngineSettings.GameMapsSettings]` has `GlobalDefaultGameMode=/Script/PoF.AARPGGameMode`, `GameInstanceClass=...`; **no `GameDefaultMap`/`EditorStartupMap`.**
- PythonScriptPlugin enabled. Run a script headless: `UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<abs path>.py"`.
- Commandlet precedent: `Source/PoFEditor/InputAssetCommandlet.cpp`.
- `GE_Damage` C++ class exists (from SP-B's generation); `UARPGLootTable` class exists.

`UE_CMD` below means `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"`.
`UPROJECT` means `"C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject"`.
`UBT` means `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe"`.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `<UE>/Source/PoF/Character/ARPGCharacterBase.h` / `.cpp` | Modify | Add `DefaultAbilities` array + grant it on possession |
| `<UE>/Source/PoF/Test/VSFunctionalTest.h` / `.cpp` | Create | `AFunctionalTest` verifying criteria #2–#5 in PIE |
| `<UE>/Content/Python/build_vertical_slice.py` | Create | Author the level, Blueprints, IMC, config |
| `docs/features/arpg-vertical-slice/ps-1-artifacts/` | Create | Git-tracked copies of the Python + C++ test (the UE project is not under git) |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-1-grayblox-slice.md` | Create | PS-1 findings |

`<UE>` = `C:\Users\kazda\Documents\Unreal Projects\PoF`.

Total: 2 UE files modified, 3 UE files created, 1 findings doc, archived artifact copies. ~4 commits to the PoF repo (the UE project itself is not git — see Cross-cutting).

---

## Task 1: Ground-truth the runtime behavior (discovery)

No code is written in this task — it reads the generated C++ and records the answers Tasks 2–5 depend on. SP-B's code has never run; these specifics cannot be assumed.

**Files:** read-only.

- [ ] **Step 1: Read the damage path of the melee ability**

Read `<UE>\Source\PoF\` — locate and read `GA_MeleeAttack.cpp` (and `ARPGGameplayAbility.cpp`). Answer and record:
- Where does `GA_MeleeAttack` apply its `DamageEffect`? On `ActivateAbility` directly, or from an AnimNotify / montage hit-window callback?
- If notify-gated: `AM_MeleeCombo` is an empty shell with no notifies — record this as **the bug to fix in Task 5** (the test's #4 will fail until damage can apply without a notify).
- What does it do with `ComboSectionNames` — is a montage section actually jumped to (would fail on the empty shell)?

- [ ] **Step 2: Read the possession / ASC-init path**

Read `ARPGCharacterBase.cpp` (`PossessedBy`, `InitializeAttributes`, any `GrantAbilities`) and `ARPGEnemyCharacter.cpp` (`GrantAbilitiesToASC`, the death flow). Record:
- The exact `PossessedBy` body and where it is safe to grant abilities (after `InitAbilityActorInfo`).
- How `ARPGEnemyCharacter` death works: what drives `Health` → 0 → the `OnEnemyDeath` delegate broadcast? Is there a `GA_Death`? Does the enemy actually `Destroy()` itself?
- Whether `InitializeAttributes()` needs `AttributeInitTable` set or has a fallback — i.e. will GAS `Health` be a sane non-zero value if the table/row are configured.

- [ ] **Step 3: Read the attribute-init data + loot table situation**

Inspect `Content/` for an existing attribute-init `UDataTable` (the row struct is `FARPGAttributeInitRow`) and any `UARPGLootTable` asset. Read `ARPGLootDropComponent.cpp`'s `DropLoot`/`DropGold`. Record:
- Does an attribute-init DataTable asset exist, and what row names? If none exists, Task 4 must create one (or set `Health` via a different path).
- The minimum loot config that makes the component spawn an `ARPGWorldItem` on death (a `LootTable` with one entry, or `bDropGold` — confirm which produces a placed actor).

- [ ] **Step 4: Record the ground-truth note**

Create `docs/features/arpg-vertical-slice/ps-1-artifacts/ground-truth.md` with the answers from Steps 1–3 — concise, just the facts that Tasks 2–5 need. Then:
```bash
git add docs/features/arpg-vertical-slice/ps-1-artifacts/ground-truth.md
git commit -m "docs(ps-1): ground-truth the generated gameplay classes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: C++ — grant abilities on possession

Closes the "player ASC is never granted any ability" gap with a minimal data-driven array on the shared base, settable from a Blueprint CDO.

**Files:**
- Modify: `<UE>\Source\PoF\Character\ARPGCharacterBase.h`
- Modify: `<UE>\Source\PoF\Character\ARPGCharacterBase.cpp`

- [ ] **Step 1: Add the `DefaultAbilities` UPROPERTY**

In `ARPGCharacterBase.h`, in the class body (public or protected section), add:
```cpp
	/** Abilities granted to this character's ASC on possession (server). Set per-Blueprint. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Abilities")
	TArray<TSubclassOf<class UGameplayAbility>> DefaultAbilities;
```
Ensure `#include "Abilities/GameplayAbility.h"` is present in the `.cpp` (not the header — the forward declare above is enough for the header).

- [ ] **Step 2: Grant them on possession**

In `ARPGCharacterBase.cpp`, in `PossessedBy()`, **after** the existing `InitAbilityActorInfo` + `InitializeAttributes()` calls (exact location confirmed in Task 1 Step 2), add a grant loop guarded to the server/authority:
```cpp
	if (HasAuthority() && AbilitySystemComponent)
	{
		for (const TSubclassOf<UGameplayAbility>& AbilityClass : DefaultAbilities)
		{
			if (AbilityClass)
			{
				AbilitySystemComponent->GiveAbility(FGameplayAbilitySpec(AbilityClass, 1, INDEX_NONE, this));
			}
		}
	}
```
Add `#include "Abilities/GameplayAbility.h"` and `#include "AbilitySystemComponent.h"` to the `.cpp` if not already present. (Use the actual ASC member name confirmed in Task 1 — it is `AbilitySystemComponent`.)

- [ ] **Step 3: Rebuild the editor target**

```bash
"<UBT>" PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```
Expected: `Result: Succeeded`. If it fails, fix the compile error (likely a missing include or the ASC member name) and rebuild.

- [ ] **Step 4: Commit the archived copy**

Copy the two modified files into the git-tracked artifact folder and commit (the UE project is not git, so the PoF repo keeps the record):
```bash
mkdir -p docs/features/arpg-vertical-slice/ps-1-artifacts/cpp
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Source/PoF/Character/ARPGCharacterBase.h" docs/features/arpg-vertical-slice/ps-1-artifacts/cpp/
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Source/PoF/Character/ARPGCharacterBase.cpp" docs/features/arpg-vertical-slice/ps-1-artifacts/cpp/
git add docs/features/arpg-vertical-slice/ps-1-artifacts/cpp
git commit -m "feat(ps-1): grant DefaultAbilities on possession (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: C++ — the functional test

A `AFunctionalTest` actor placed in the slice level; the automation framework runs it in PIE. It verifies criteria #2–#5 by reading real game state.

**Files:**
- Create: `<UE>\Source\PoF\Test\VSFunctionalTest.h`
- Create: `<UE>\Source\PoF\Test\VSFunctionalTest.cpp`

- [ ] **Step 1: Write the header**

Create `<UE>\Source\PoF\Test\VSFunctionalTest.h`:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSFunctionalTest.generated.h"

/** Verifies the gray-box vertical slice: movement, attack activation, damage, death+loot. */
UCLASS()
class POF_API AVSFunctionalTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSFunctionalTest();

	virtual void PrepareTest() override;
	virtual void StartTest() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	int32 Phase = 0;
	float PhaseTime = 0.f;
	FVector StartLocation = FVector::ZeroVector;
	float EnemyStartHealth = 0.f;
	TWeakObjectPtr<class AARPGEnemyCharacter> Enemy;
	TWeakObjectPtr<class AARPGPlayerCharacter> Player;
};
```
The `POF_API` macro and module are correct — this lives in the `PoF` runtime module. `FunctionalTest.h` requires the `FunctionalTesting` module: add `"FunctionalTesting"` to `PublicDependencyModuleNames` in `<UE>\Source\PoF\PoF.Build.cs`.

- [ ] **Step 2: Write the implementation**

Create `<UE>\Source\PoF\Test\VSFunctionalTest.cpp`. The structure below is the contract; the exact attribute/ability accessors come from Task 1. Implement a phased test driven from `Tick`:
```cpp
#include "Test/VSFunctionalTest.h"
#include "Player/ARPGPlayerCharacter.h"
#include "Character/ARPGEnemyCharacter.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystemBlueprintLibrary.h"
#include "GameplayTagContainer.h"
#include "Loot/ARPGWorldItem.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"

AVSFunctionalTest::AVSFunctionalTest()
{
	PrimaryActorTick.bCanEverTick = true;
	TimeLimit = 30.f;            // hard cap; FinishTest is called before this
}

void AVSFunctionalTest::PrepareTest()
{
	Super::PrepareTest();
	Phase = 0;
	PhaseTime = 0.f;
}

void AVSFunctionalTest::StartTest()
{
	Super::StartTest();
	Player = Cast<AARPGPlayerCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
	for (TActorIterator<AARPGEnemyCharacter> It(GetWorld()); It; ++It) { Enemy = *It; break; }
	if (!Player.IsValid() || !Enemy.IsValid())
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Player or Enemy missing in the slice level"));
		return;
	}
	StartLocation = Player->GetActorLocation();
}

void AVSFunctionalTest::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!IsRunning() || !Player.IsValid()) { return; }
	PhaseTime += DeltaSeconds;

	switch (Phase)
	{
	case 0: // #2 movement — push the player, then check displacement
		Player->AddMovementInput(FVector::ForwardVector, 1.f);
		if (PhaseTime > 1.5f)
		{
			const float Moved = FVector::Dist(Player->GetActorLocation(), StartLocation);
			AssertTrue(Moved > 50.f, FString::Printf(TEXT("#2 movement: moved %.1f units"), Moved));
			Phase = 1; PhaseTime = 0.f;
		}
		break;

	case 1: // #3 attack activation — activate the melee ability by tag
	{
		UAbilitySystemComponent* ASC = UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent(Player.Get());
		const bool Activated = ASC && ASC->TryActivateAbilitiesByTag(
			FGameplayTagContainer(FGameplayTag::RequestGameplayTag(TEXT("Ability.Melee.LightAttack"))));
		AssertTrue(Activated, TEXT("#3 attack: GA_MeleeAttack activated"));
		EnemyStartHealth = /* read enemy GAS Health — accessor from Task 1 */ 0.f;
		Phase = 2; PhaseTime = 0.f;
		break;
	}

	case 2: // #4 damage — place player in melee range, attack, check enemy Health dropped
		// move the player adjacent to the enemy, trigger an attack, wait, then assert
		// EnemyHealthNow < EnemyStartHealth  (accessor from Task 1)
		if (PhaseTime > 2.0f)
		{
			// AssertTrue(EnemyHealthNow < EnemyStartHealth, TEXT("#4 damage: enemy Health decreased"));
			Phase = 3; PhaseTime = 0.f;
		}
		break;

	case 3: // #5 death + loot — drive enemy Health to 0, assert destroyed + loot spawned
		// apply lethal damage to the enemy ASC (a damage GE, magnitude >= MaxHealth)
		if (PhaseTime > 2.0f)
		{
			int32 LootCount = 0;
			for (TActorIterator<AARPGWorldItem> It(GetWorld()); It; ++It) { ++LootCount; }
			const bool EnemyGone = !Enemy.IsValid() || Enemy->IsActorBeingDestroyed();
			AssertTrue(EnemyGone, TEXT("#5: enemy destroyed"));
			AssertTrue(LootCount >= 1, FString::Printf(TEXT("#5: %d loot actor(s) spawned"), LootCount));
			FinishTest(EFunctionalTestResult::Default, TEXT("vertical slice verified"));
		}
		break;
	}
}
```
The commented spans (enemy Health accessor, the in-range attack, the lethal-damage application) are filled from Task 1's findings — they depend on the exact `UARPGAttributeSet` accessor and the damage GE. Keep each criterion an explicit `AssertTrue` with a descriptive message; `FinishTest(EFunctionalTestResult::Default, ...)` reports pass when no assert failed.

- [ ] **Step 3: Rebuild the editor target**

```bash
"<UBT>" PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```
Expected: `Result: Succeeded`. Fix compile errors (missing includes, accessor names) and rebuild until clean.

- [ ] **Step 4: Commit the archived copy**

```bash
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Source/PoF/Test/VSFunctionalTest.h" docs/features/arpg-vertical-slice/ps-1-artifacts/cpp/
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Source/PoF/Test/VSFunctionalTest.cpp" docs/features/arpg-vertical-slice/ps-1-artifacts/cpp/
git add docs/features/arpg-vertical-slice/ps-1-artifacts/cpp
git commit -m "feat(ps-1): VSFunctionalTest — in-PIE slice verification (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: UE Python — author the slice

One Python script builds everything: the level, the Blueprints, the IMC, and the config. UE Python authors *assets and CDO properties* — not Blueprint event graphs (the spec's design avoids graph authoring; the `DefaultAbilities` array from Task 2 is why ability-granting is a CDO set).

**Files:**
- Create: `<UE>\Content\Python\build_vertical_slice.py`

- [ ] **Step 1: Write the authoring script**

Create `<UE>\Content\Python\build_vertical_slice.py`. It must, using the `unreal` module, in order:
1. Create an `IMC` Input Mapping Context asset at `/Game/Input/IMC_VerticalSlice`, add a mapping `IA_Move` ↔ W/A/S/D (with the 2D-axis modifiers) and `IA_Attack` ↔ left mouse button. Save it.
2. Create `BP_GA_MeleeAttack` (parent `UGA_MeleeAttack`) — set `AttackMontage` to the existing `/Game/Characters/Player/Animations/Montages/AM_MeleeCombo`, `ComboSectionNames` to `["Combo1"]`, `DamageEffect` to the project's damage GE class (from Task 1). Save.
3. Create `BP_VSPlayer` (parent `AARPGPlayerCharacter`) — on its CDO: attach a `/Engine/BasicShapes/Cylinder` static mesh as a visible body component; set `DefaultAbilities = [BP_GA_MeleeAttack]`; set `AttributeInitTable`/`AttributeInitRowName` per Task 1. Save.
4. Create `BP_VSPlayerController` (parent `AARPGPlayerController`) — set `DefaultMappingContext` → `IMC_VerticalSlice`, `IA_Move` → `IA_Move`, `IA_PrimaryAttack` → `IA_Attack`. Save.
5. Create `BP_VSEnemy` (parent `AARPGEnemyCharacter`) — attach a `/Engine/BasicShapes/Cube` static mesh body; set `AttributeInitRowName` to a low-Health enemy row; configure `LootDropComponent` per Task 1 (a minimal `LootTable` or gold drop). Save.
6. Create `BP_VSGameMode` (parent `AARPGGameMode`) — `DefaultPawnClass` → `BP_VSPlayer`, `PlayerControllerClass` → `BP_VSPlayerController`. Save.
7. Create a new level `/Game/Maps/VerticalSlice`: add a floor (a `/Engine/BasicShapes/Cube` `AStaticMeshActor` scaled wide and flat, collision on), a `ADirectionalLight`, a `ASkyLight`, a `APlayerStart` above the floor, one `BP_VSEnemy` placed a few metres from the start, and one `AVSFunctionalTest` actor. Save the level.
8. Set project config: in `Config/DefaultEngine.ini` `[/Script/EngineSettings.GameMapsSettings]`, set `GameDefaultMap` and `EditorStartupMap` to `/Game/Maps/VerticalSlice`, and `GlobalDefaultGameMode` to `BP_VSGameMode`. (Use `unreal` settings APIs or edit the INI directly — whichever Task 1 confirms reliable.)

Use these `unreal` APIs: `unreal.AssetToolsHelpers.get_asset_tools().create_asset(...)` with `unreal.BlueprintFactory` (set `parent_class`); `unreal.EditorAssetLibrary` for save/load; `unreal.get_default_object(bp_generated_class)` to set CDO properties; `unreal.EditorLevelLibrary` / `unreal.LevelEditorSubsystem` to create the level and `spawn_actor_from_class` / `spawn_actor_from_object` to place actors; `unreal.EditorAssetLibrary.save_asset`. Wrap each section in try/except that logs `unreal.log_error` and re-raises, so a failure is visible in the headless run.

The script is long and its exact API calls depend on Task 1; write it section by section, running Step 2 after each section to catch errors early rather than authoring it all blind.

- [ ] **Step 2: Run the authoring script headless**

```bash
"<UE_CMD>" "<UPROJECT>" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_vertical_slice.py" -unattended -nopause 2>&1
```
Expected: the script runs to completion, the log shows each asset created/saved, and exit code 0. On an error, read the logged exception, fix that section of the script, and re-run. Re-running must be idempotent — the script should overwrite/skip already-created assets, not error on them.

- [ ] **Step 3: Verify the assets exist**

```bash
ls "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Maps/VerticalSlice.umap"
ls "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Input/IMC_VerticalSlice.uasset"
```
Expected: both exist. Spot-check that the `BP_VS*` Blueprints exist under their content paths.

- [ ] **Step 4: Commit the archived copy**

```bash
mkdir -p docs/features/arpg-vertical-slice/ps-1-artifacts/python
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/build_vertical_slice.py" docs/features/arpg-vertical-slice/ps-1-artifacts/python/
git add docs/features/arpg-vertical-slice/ps-1-artifacts/python
git commit -m "feat(ps-1): UE Python slice-authoring script (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Run the functional test and close the gameplay loop

This is the fix-loop — the first time the assembled slice actually runs. Expect bugs in SP-B's generated systems; fix each, re-run.

**Files:** iterative fixes to the Task 2–4 files (and possibly other generated `<UE>\Source\PoF\` files).

- [ ] **Step 1: Run the functional test headless**

```bash
"<UE_CMD>" "<UPROJECT>" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests./Game/Maps/VerticalSlice;Quit" -unattended -nopause -nullrhi -log 2>&1
```
(The exact test path is what UE prints when it discovers the placed `AVSFunctionalTest` — adjust the `RunTests` filter to match what the log reports on first run.) Expected eventually: all four `AssertTrue`s pass and the test reports `Success`.

- [ ] **Step 2: Diagnose and fix — iterate**

On each failure, read the automation log + `<UE>\Saved\Logs\PoF.log`. Likely failure classes, each a real wiring bug to fix at the source:
- **#3 fails** — the ability did not activate: `GA_MeleeAttack`'s `AttackMontage`/`ComboSectionNames` not satisfied, the tag wrong, or `DefaultAbilities` not granted. Fix the BP config (Task 4 script) or the grant code (Task 2).
- **#4 fails** — enemy Health did not drop: damage is notify-gated on the empty montage (Task 1 Step 1). Fix `GA_MeleeAttack` to apply `DamageEffect` on activation, or have the test apply the damage GE directly and assert the GAS pipeline — record which.
- **#5 fails** — enemy did not die or no loot: the death flow does not broadcast `OnEnemyDeath`, or the loot component is misconfigured. Fix the generated death/loot code.

Each fix: edit the UE source / Python, rebuild (`UBT` if C++ changed) or re-run the Python (if asset config changed), re-run Step 1. Record every fix for the findings doc. If a fix is to a generated `<UE>\Source\PoF\` file, copy that file into `ps-1-artifacts/cpp/` before the final commit.

- [ ] **Step 3: Confirm the green run**

When Step 1 reports all of #2–#5 green, capture the full automation summary block. Do not proceed until the test genuinely passes.

- [ ] **Step 4: Commit the fixes**

```bash
# copy any generated-source files changed during the fix-loop into ps-1-artifacts/cpp/ first
git add docs/features/arpg-vertical-slice/ps-1-artifacts
git commit -m "fix(ps-1): close the gray-box gameplay loop — slice verified

[one line per bug fixed during the fix-loop]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Gemini sanity check + findings + close

**Files:**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-1-grayblox-slice.md`

- [ ] **Step 1: Capture a PIE screenshot and run Gemini vision**

Launch the slice and take a screenshot via UE's `HighResShot` console command:
```bash
"<UE_CMD>" "<UPROJECT>" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720;" 2>&1
```
The screenshot lands under `<UE>\Saved\Screenshots\`. Then describe it with Gemini (load env first):
```bash
cd C:/Users/kazda/kiro/personas
export $(grep -E '^(GEMINI_API_KEY)=' .env | xargs)
node .claude/skills/leonardo/tools/gemini-recognize.mjs --input "<screenshot path>" --prompt "Describe this game scene: is there a character figure on a lit floor, and a separate box-like object nearby? List what you see."
```
Record Gemini's description. This is a sanity check — it informs the findings, it does not gate PS-1.

- [ ] **Step 2: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-1-grayblox-slice.md` recording: the functional-test result per criterion (#2–#5 with the assert messages), every bug found in SP-B's generated systems and how it was fixed, the Gemini sanity-check description, and a "ready for PS-2" note (the slice runs; real character/enemy/environment content is the next sub-project).

- [ ] **Step 3: Commit + final summary**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-1-grayblox-slice.md
git commit -m "docs(features): PS-1 findings — gray-box playable slice verified

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git log --oneline -8
```
Then post a chat summary: PS-1 status, the criteria results, the bugs fixed in the generated systems, and that PS-2 (Blender 3D content) is the next brainstorm.

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec "authoring mechanism" (UE Python) → Task 4. "wiring gaps" — ability granting → Task 2; controller BP + IMC → Task 4; `GA_MeleeAttack` config → Task 4 + the Task 5 fix-loop; enemy = `AARPGEnemyCharacter` → Task 4/Task 1. "What PS-1 builds" items 1–5 → Task 4 Step 1. Verification (C++ functional test, #2–#5) → Task 3 + Task 5. Gemini sanity check → Task 6. Spec DoD 1–5 → Tasks 4/3/5/6/6.
- [x] **Discovery task justified:** SP-B's code has never run and its damage/death/loot paths cannot be assumed — Task 1 reads them and its `ground-truth.md` is referenced by Tasks 2/3/4/5. The Task 3/4 code blocks mark exactly which spans are Task-1-dependent rather than guessing.
- [x] **Placeholder scan:** no "TBD"/"add error handling". The commented spans in Task 3's `.cpp` and Task 4's script sections are explicit, labelled Task-1-dependent fill-ins — unavoidable for integration code against unread generated classes; the surrounding contract (asserts, phases, asset list, APIs) is concrete.
- [x] **Type consistency:** `DefaultAbilities` (Task 2) is the array `BP_VSPlayer` sets (Task 4) and the grant loop reads (Task 2). `AVSFunctionalTest` (Task 3) is placed by Task 4 Step 1.7 and run by Task 5. `BP_VS*` / `BP_GA_MeleeAttack` / `IMC_VerticalSlice` names consistent across Tasks 4–6. `UBT`/`UE_CMD`/`UPROJECT` defined once.
- [x] **UE project not git:** every UE-source/Python change is archived into the git-tracked `ps-1-artifacts/` and committed there; the PoF-repo commits are the artifact copies + the findings doc.
- [x] **Bite-sized:** T1=4, T2=4, T3=4, T4=4, T5=4, T6=3 steps; each a single action. Task 5 is an explicit, bounded fix-loop (the spec's expected-bugs risk).
