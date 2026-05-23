# Enemy AI + player-takes-damage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vertical-slice enemy hostile — a pure-C++ AI controller that chases the player and triggers the enemy melee ability, so the player's GAS Health drops and the HUD player bar moves — verified by a new in-engine functional test.

**Architecture:** A new `AARPGSimpleAIController : AAIController` steers the enemy toward the player (direct `AddMovementInput`, nav-independent) and, when in `AttackRange`, activates `GA_EnemyMeleeAttack` by its `Ability.Enemy.Melee` asset tag respecting `AttackCooldown`. `GA_EnemyMeleeAttack` gets the same gray-box fallback the player's `GA_MeleeAttack` has, so its front-arc damage still lands with the project's empty `SwingMontage`. A UE Python script wires `BP_VSEnemy`'s CDO (controller class + granted ability) and builds an isolated `/Game/Maps/VSEnemyAttack` test map. A new `AVSEnemyAttackTest` asserts the player takes damage; the PS-1 `AVSFunctionalTest` is re-run as a regression gate.

**Tech Stack:** UE 5.7 C++ (GAS: `UAbilitySystemComponent`, `UGameplayAbility`, `UARPGAttributeSet`, gameplay tags), `AAIController`, `AFunctionalTest`; UE Python (`LevelEditorSubsystem`, `EditorActorSubsystem`, BP CDO writes); headless `UnrealEditor-Cmd Automation RunTests`.

**Repo split:** All UE-project changes (`C:\Users\kazda\Documents\Unreal Projects\PoF`) commit to the UE repo `github.com/xkazm04/pof-exp` (pushes work). The spec/plan/findings live in the PoF app repo `C:\Users\kazda\kiro\pof` (commit locally only — user pushes manually).

**Key paths (ground-truthed):**
- Enemy ability: `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.{h,cpp}`
- Player ability (fallback reference): `Source/PoF/AbilitySystem/GA_MeleeAttack.cpp`
- Enemy character: `Source/PoF/Character/ARPGEnemyCharacter.{h,cpp}` (`AIControllerClass` defaults to `AARPGAIController`; `AutoPossessAI = PlacedInWorldOrSpawned` already set; `GrantAbilitiesToASC()` grants `GrantedAbilities` on possession; getters `GetAttackRange()`, `GetAttackCooldown()`, `IsDead()`, `GetAbilitySystemComponent()`)
- PS-1 test (mirror): `Source/PoF/Test/VSFunctionalTest.{h,cpp}`
- Build module list: `Source/PoF/PoF.Build.cs` (`AIModule` already present — no edit needed)
- Tags (exist): `ARPGGameplayTags::Ability_Enemy_Melee`, `ARPGGameplayTags::Event_MeleeHit`
- Damage GE: `UGE_Damage` (`AbilitySystem/Effects/GE_Damage.h`, `UGE_Damage::StaticClass()`)
- Slice level + Python build pattern: `Content/Python/build_vertical_slice.py` (`LEVEL_PATH = "/Game/Maps/VerticalSlice"`), `Content/Python/setup_characters_ue.py` (CDO-write + sidecar-log pattern)

**Tooling note (from the project's existing scripts):** UE root is `C:\Program Files\Epic Games\UE_5.7`. Python runs headless via `-run=pythonscript` (this is what `build_vertical_slice.py` uses for level + CDO ops). If a level op crashes under `-run=pythonscript`, retry with the full-editor form `UnrealEditor.exe ... -ExecutePythonScript="<path>"`. Headless test/Python runs end with a benign exit-3 shutdown crash — **judge success by log content, not the process exit code.**

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `Source/PoF/AI/ARPGSimpleAIController.h` | Pure-C++ chase+attack controller interface | Create |
| `Source/PoF/AI/ARPGSimpleAIController.cpp` | Tick: steer toward player, attack-on-range by tag | Create |
| `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h` | Add fallback flags + window + handler | Modify |
| `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.cpp` | Gray-box fallback; default `DamageEffect`; guards | Modify |
| `Source/PoF/Test/VSEnemyAttackTest.h` | Functional-test interface (player-takes-damage) | Create |
| `Source/PoF/Test/VSEnemyAttackTest.cpp` | Teleport player into arc, assert Health dropped | Create |
| `Content/Python/setup_enemy_ai.py` | Wire `BP_VSEnemy` CDO + build `/Game/Maps/VSEnemyAttack` | Create |

All under the UE project root `C:\Users\kazda\Documents\Unreal Projects\PoF\`.

**On TDD ordering:** UE gameplay code has no isolated unit-test harness here — the test vehicle is the in-engine `AFunctionalTest`, which needs a compiled editor + a built map. A full UE rebuild is expensive, so we batch the three C++ files into one build rather than forcing an intermediate failing-run per file. `AVSEnemyAttackTest` is authored to fail if the enemy is passive (it is, before the wiring) and to pass once the controller + ability-grant + fallback are in place; we observe that pass in Task 7. This matches the proven PS-1/HUD/Characters workflow.

---

## Task 1: `AARPGSimpleAIController` (pure-C++ chase + attack)

**Files:**
- Create: `Source/PoF/AI/ARPGSimpleAIController.h`
- Create: `Source/PoF/AI/ARPGSimpleAIController.cpp`

- [ ] **Step 1: Write the header**

`Source/PoF/AI/ARPGSimpleAIController.h`:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "GameplayTagContainer.h"
#include "ARPGSimpleAIController.generated.h"

class AARPGEnemyCharacter;

/**
 * Minimal pure-C++ enemy AI controller — no Behaviour Tree, no blackboard.
 *
 * Each tick it finds the player, steers straight toward them with
 * AddMovementInput (nav-independent — works on the bare arena floor), and once
 * within the enemy's AttackRange faces the player and activates the enemy's
 * melee ability by tag, respecting AttackCooldown.
 *
 * Set as AIControllerClass on BP_VSEnemy to make the slice enemy hostile
 * without authoring a Behaviour Tree asset (the binary-content wall).
 */
UCLASS()
class POF_API AARPGSimpleAIController : public AAIController
{
	GENERATED_BODY()

public:
	AARPGSimpleAIController();

	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;
	virtual void Tick(float DeltaSeconds) override;

protected:
	/** Tag used to activate the controlled enemy's attack ability (matches GA_EnemyMeleeAttack's asset tag). */
	UPROPERTY(EditDefaultsOnly, Category = "Simple AI")
	FGameplayTag AttackAbilityTag;

private:
	TWeakObjectPtr<AARPGEnemyCharacter> ControlledEnemy;
	float TimeSinceLastAttack = 0.f;
};
```

- [ ] **Step 2: Write the implementation**

`Source/PoF/AI/ARPGSimpleAIController.cpp`:

```cpp
#include "AI/ARPGSimpleAIController.h"
#include "Character/ARPGEnemyCharacter.h"
#include "Character/ARPGCharacterBase.h"
#include "AbilitySystem/ARPGGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "Kismet/GameplayStatics.h"

AARPGSimpleAIController::AARPGSimpleAIController()
{
	PrimaryActorTick.bCanEverTick = true;
	AttackAbilityTag = ARPGGameplayTags::Ability_Enemy_Melee;
}

void AARPGSimpleAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	ControlledEnemy = Cast<AARPGEnemyCharacter>(InPawn);
	// Large initial value so the first in-range tick attacks immediately.
	TimeSinceLastAttack = 1000.f;
}

void AARPGSimpleAIController::OnUnPossess()
{
	ControlledEnemy = nullptr;
	Super::OnUnPossess();
}

void AARPGSimpleAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!ControlledEnemy.IsValid() || ControlledEnemy->IsDead())
	{
		return;
	}

	APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!PlayerPawn)
	{
		return;
	}
	if (const AARPGCharacterBase* PlayerChar = Cast<AARPGCharacterBase>(PlayerPawn))
	{
		if (PlayerChar->IsDead())
		{
			return;
		}
	}

	TimeSinceLastAttack += DeltaSeconds;

	const FVector EnemyLoc = ControlledEnemy->GetActorLocation();
	const FVector PlayerLoc = PlayerPawn->GetActorLocation();
	const float Dist = FVector::Dist(EnemyLoc, PlayerLoc);
	const float Range = ControlledEnemy->GetAttackRange();

	if (Dist > Range)
	{
		// Chase: steer straight toward the player (nav-independent on the flat arena).
		const FVector Dir = (PlayerLoc - EnemyLoc).GetSafeNormal2D();
		ControlledEnemy->AddMovementInput(Dir, 1.f);
		return;
	}

	// In range: face the player so the front-arc damage lands, then attack on cooldown.
	const FVector ToPlayer = PlayerLoc - EnemyLoc;
	ControlledEnemy->SetActorRotation(FRotator(0.f, ToPlayer.Rotation().Yaw, 0.f));

	if (TimeSinceLastAttack >= ControlledEnemy->GetAttackCooldown())
	{
		if (UAbilitySystemComponent* ASC = ControlledEnemy->GetAbilitySystemComponent())
		{
			FGameplayTagContainer Tags;
			Tags.AddTag(AttackAbilityTag);
			if (ASC->TryActivateAbilitiesByTag(Tags))
			{
				TimeSinceLastAttack = 0.f;
			}
		}
	}
}
```

- [ ] **Step 3: Sanity-check (no build yet — batched into Task 4)**

Confirm: `AIModule` is already in `PoF.Build.cs` (verified — line 11). `AARPGEnemyCharacter::GetAbilitySystemComponent()`, `GetAttackRange()`, `GetAttackCooldown()`, `IsDead()` are all public (verified in `ARPGEnemyCharacter.h` / used in `VSFunctionalTest.cpp`). No edits to `ARPGEnemyCharacter` needed.

---

## Task 2: `GA_EnemyMeleeAttack` gray-box fallback + default `DamageEffect`

**Files:**
- Modify: `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h`
- Modify: `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.cpp`

Mirrors the proven `GA_MeleeAttack` pattern: the `Event.MeleeHit` listener is set up first so it outlives a montage that fails to play; the fallback flag is pre-armed before `ReadyForActivation()` so a synchronous `OnInterrupted`/`OnCancelled` (empty montage) doesn't `EndAbility` and tear down the listener; with no playable montage a `WaitDelay` drives `PerformFrontArcDamage()` once; a `bDamageApplied` guard prevents double-application. Defaulting `DamageEffect` in C++ means the raw `UGA_EnemyMeleeAttack` class can be granted directly — no config-BP needed.

- [ ] **Step 1: Header — add fallback members + handler**

In `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h`, the `protected:` section already has `SwingMontage`, `MontagePlayRate`, `DamageEffect`, `BaseDamage`, `HitRadius`, `HitHalfAngle`. Add a fallback-window property after `HitHalfAngle` (still in `protected:`):

```cpp
	/** Attack-window length (s) used when no swing montage can play (gray-box avatar / empty montage). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Enemy Melee", meta = (ClampMin = "0.05"))
	float FallbackAttackWindow = 0.3f;
```

In the `private:` section, replace:

```cpp
	UFUNCTION()
	void OnMeleeHitEvent(FGameplayEventData Payload);

	void PerformFrontArcDamage();
};
```

with:

```cpp
	UFUNCTION()
	void OnMeleeHitEvent(FGameplayEventData Payload);

	UFUNCTION()
	void OnFallbackWindowElapsed();

	void PerformFrontArcDamage();

	/** True while running the timer-driven fallback (no playable swing montage). Pre-armed before ReadyForActivation. */
	bool bUsingFallbackWindow = false;

	/** Guard so the fallback front-arc damage applies at most once per activation. */
	bool bDamageApplied = false;
};
```

- [ ] **Step 2: Cpp — add includes**

In `Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.cpp`, the includes currently end with the two `Abilities/Tasks/...` lines. Add three includes after them:

Replace:
```cpp
#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "Abilities/Tasks/AbilityTask_WaitGameplayEvent.h"
```
with:
```cpp
#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "Abilities/Tasks/AbilityTask_WaitGameplayEvent.h"
#include "Abilities/Tasks/AbilityTask_WaitDelay.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/Character.h"
#include "AbilitySystem/Effects/GE_Damage.h"
```

- [ ] **Step 3: Cpp — default `DamageEffect` in the constructor**

Replace the constructor body:
```cpp
UGA_EnemyMeleeAttack::UGA_EnemyMeleeAttack()
{
	bAutoEndAbility = false;

	SetAssetTags(FGameplayTagContainer(ARPGGameplayTags::Ability_Enemy_Melee));
	ActivationOwnedTags.AddTag(ARPGGameplayTags::State_Attacking);
	ActivationBlockedTags.AddTag(ARPGGameplayTags::State_Attacking);
}
```
with:
```cpp
UGA_EnemyMeleeAttack::UGA_EnemyMeleeAttack()
{
	bAutoEndAbility = false;

	SetAssetTags(FGameplayTagContainer(ARPGGameplayTags::Ability_Enemy_Melee));
	ActivationOwnedTags.AddTag(ARPGGameplayTags::State_Attacking);
	ActivationBlockedTags.AddTag(ARPGGameplayTags::State_Attacking);

	// Default the damage effect so the raw C++ ability can be granted directly
	// (no config-BP). A Blueprint subclass may still override this.
	DamageEffect = UGE_Damage::StaticClass();
}
```

- [ ] **Step 4: Cpp — rewrite `ActivateAbility` (listener first + montage pre-check + fallback)**

Replace the entire `ActivateAbility` body:
```cpp
void UGA_EnemyMeleeAttack::ActivateAbility(
	const FGameplayAbilitySpecHandle Handle,
	const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo,
	const FGameplayEventData* TriggerEventData)
{
	if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
	{
		EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
		return;
	}

	if (AARPGCharacterBase* Character = GetARPGCharacter())
	{
		Character->SetAttacking(true);
	}

	// Play the swing montage
	UAbilityTask_PlayMontageAndWait* MontageTask = UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
		this, TEXT("PlayEnemyMelee"), SwingMontage, MontagePlayRate, NAME_None, true);

	MontageTask->OnCompleted.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageCompleted);
	MontageTask->OnBlendOut.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageCompleted);
	MontageTask->OnInterrupted.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageInterrupted);
	MontageTask->OnCancelled.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageInterrupted);
	MontageTask->ReadyForActivation();

	// Listen for MeleeHit event from AnimNotifyState_HitDetection
	UAbilityTask_WaitGameplayEvent* WaitHit = UAbilityTask_WaitGameplayEvent::WaitGameplayEvent(
		this, ARPGGameplayTags::Event_MeleeHit, nullptr, false, true);

	WaitHit->EventReceived.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMeleeHitEvent);
	WaitHit->ReadyForActivation();
}
```
with:
```cpp
void UGA_EnemyMeleeAttack::ActivateAbility(
	const FGameplayAbilitySpecHandle Handle,
	const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo,
	const FGameplayEventData* TriggerEventData)
{
	if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
	{
		EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
		return;
	}

	if (AARPGCharacterBase* Character = GetARPGCharacter())
	{
		Character->SetAttacking(true);
	}

	bDamageApplied = false;

	// Set up the MeleeHit listener FIRST, before the montage. It must outlive a
	// montage that fails to play — otherwise EndAbility tears it down before a
	// hit can land.
	UAbilityTask_WaitGameplayEvent* WaitHit = UAbilityTask_WaitGameplayEvent::WaitGameplayEvent(
		this, ARPGGameplayTags::Event_MeleeHit, nullptr, false, true);
	WaitHit->EventReceived.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMeleeHitEvent);
	WaitHit->ReadyForActivation();

	// Determine whether this avatar can actually play the swing montage. On a
	// gray-box character (no SkeletalMesh / AnimInstance) or with an empty
	// montage, PlayMontageAndWait fails internally; we skip it and run a pure
	// timer-driven attack window instead.
	bool bCanPlayMontage = false;
	if (SwingMontage)
	{
		if (ACharacter* Character = Cast<ACharacter>(GetAvatarActorFromActorInfo()))
		{
			if (USkeletalMeshComponent* MeshComp = Character->GetMesh())
			{
				bCanPlayMontage =
					MeshComp->GetSkeletalMeshAsset() != nullptr && MeshComp->GetAnimInstance() != nullptr;
			}
		}
	}

	if (bCanPlayMontage)
	{
		// Pre-arm the fallback flag BEFORE ReadyForActivation() so a synchronous
		// OnInterrupted/OnCancelled (empty/zero-length montage with a live
		// AnimInstance) sees bUsingFallbackWindow=true and does NOT call
		// EndAbility — which would destroy the Event.MeleeHit listener. If the
		// montage actually starts, we reset the flag below.
		bUsingFallbackWindow = true;

		UAbilityTask_PlayMontageAndWait* MontageTask = UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
			this, TEXT("PlayEnemyMelee"), SwingMontage, MontagePlayRate, NAME_None, true);

		MontageTask->OnCompleted.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageCompleted);
		MontageTask->OnBlendOut.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageCompleted);
		MontageTask->OnInterrupted.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageInterrupted);
		MontageTask->OnCancelled.AddDynamic(this, &UGA_EnemyMeleeAttack::OnMontageInterrupted);
		MontageTask->ReadyForActivation();

		// Confirm the montage actually started; if not (empty montage), fall through.
		UAbilitySystemComponent* ASC = GetARPGAbilitySystemComponent();
		if (ASC && ASC->GetCurrentMontage() == SwingMontage)
		{
			bUsingFallbackWindow = false;
			return;
		}
		// Montage did not start — bUsingFallbackWindow stays true; fall through.
	}

	// Fallback path: no playable montage. Keep the ability (and its hit listener)
	// alive for a fixed window, then perform the front-arc damage and end.
	bUsingFallbackWindow = true;
	UE_LOG(LogTemp, Log,
		TEXT("[GA_EnemyMelee] No playable swing montage; using %.2fs timer-driven attack window."),
		FallbackAttackWindow);

	UAbilityTask_WaitDelay* FallbackTask = UAbilityTask_WaitDelay::WaitDelay(this, FallbackAttackWindow);
	FallbackTask->OnFinish.AddDynamic(this, &UGA_EnemyMeleeAttack::OnFallbackWindowElapsed);
	FallbackTask->ReadyForActivation();
}
```

- [ ] **Step 5: Cpp — `EndAbility` resets the flags**

Replace:
```cpp
void UGA_EnemyMeleeAttack::EndAbility(
	const FGameplayAbilitySpecHandle Handle,
	const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo,
	bool bReplicateEndAbility,
	bool bWasCancelled)
{
	if (AARPGCharacterBase* Character = GetARPGCharacter())
	{
		Character->SetAttacking(false);
	}

	Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```
with:
```cpp
void UGA_EnemyMeleeAttack::EndAbility(
	const FGameplayAbilitySpecHandle Handle,
	const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo,
	bool bReplicateEndAbility,
	bool bWasCancelled)
{
	// Reset transient fallback state so a future activation starts clean.
	bUsingFallbackWindow = false;
	bDamageApplied = false;

	if (AARPGCharacterBase* Character = GetARPGCharacter())
	{
		Character->SetAttacking(false);
	}

	Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```

- [ ] **Step 6: Cpp — guard the montage callbacks + add the fallback handler**

Replace:
```cpp
void UGA_EnemyMeleeAttack::OnMontageCompleted()
{
	EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, false);
}

void UGA_EnemyMeleeAttack::OnMontageInterrupted()
{
	EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, true);
}
```
with:
```cpp
void UGA_EnemyMeleeAttack::OnMontageCompleted()
{
	// Ignore a stale completed/blend-out callback from a montage that failed to
	// play — the fallback timer keeps the ability (and its hit listener) alive.
	if (bUsingFallbackWindow)
	{
		return;
	}
	EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, false);
}

void UGA_EnemyMeleeAttack::OnMontageInterrupted()
{
	// Ignore an interrupt/cancel that is really "the montage never played".
	if (bUsingFallbackWindow)
	{
		return;
	}
	EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, true);
}

void UGA_EnemyMeleeAttack::OnFallbackWindowElapsed()
{
	// The fallback attack window expired — apply the front-arc damage the montage
	// notify would have triggered, then end the ability normally.
	PerformFrontArcDamage();
	EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, false);
}
```

- [ ] **Step 7: Cpp — once-per-activation guard in `PerformFrontArcDamage`**

In `PerformFrontArcDamage()`, replace the opening:
```cpp
void UGA_EnemyMeleeAttack::PerformFrontArcDamage()
{
	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character || !DamageEffect) return;
```
with:
```cpp
void UGA_EnemyMeleeAttack::PerformFrontArcDamage()
{
	if (bDamageApplied)
	{
		return;
	}
	bDamageApplied = true;

	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character || !DamageEffect) return;
```

(The rest of `PerformFrontArcDamage` and all of `OnMeleeHitEvent` are unchanged.)

---

## Task 3: `AVSEnemyAttackTest` functional test

**Files:**
- Create: `Source/PoF/Test/VSEnemyAttackTest.h`
- Create: `Source/PoF/Test/VSEnemyAttackTest.cpp`

Mirrors `AVSFunctionalTest` (same base, same `LogWarningHandling = OutputIgnored`). Single phase: at `StartTest`, record the player's Health and teleport the player squarely into the enemy's front arc within `AttackRange`; the enemy's `AARPGSimpleAIController` then activates `GA_EnemyMeleeAttack`, whose fallback applies front-arc `GE_Damage`. After 1.5 s, assert the player's Health dropped. Teleporting into the arc makes the test deterministic and independent of chase movement.

- [ ] **Step 1: Write the header**

`Source/PoF/Test/VSEnemyAttackTest.h`:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSEnemyAttackTest.generated.h"

/** Verifies the slice enemy is hostile: it activates its melee ability and the player takes GAS damage. */
UCLASS()
class POF_API AVSEnemyAttackTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSEnemyAttackTest();

	virtual void PrepareTest() override;
	virtual void StartTest() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	float PhaseTime = 0.f;
	float PlayerStartHealth = 0.f;
	TWeakObjectPtr<class AARPGEnemyCharacter> Enemy;
	TWeakObjectPtr<class AARPGPlayerCharacter> Player;
};
```

- [ ] **Step 2: Write the implementation**

`Source/PoF/Test/VSEnemyAttackTest.cpp`:

```cpp
#include "Test/VSEnemyAttackTest.h"
#include "Player/ARPGPlayerCharacter.h"
#include "Character/ARPGEnemyCharacter.h"
#include "AbilitySystem/ARPGAttributeSet.h"
#include "AbilitySystemComponent.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"

AVSEnemyAttackTest::AVSEnemyAttackTest()
{
	PrimaryActorTick.bCanEverTick = true;
	TimeLimit = 20.f;

	// Gray-box slice: empty montages produce incidental engine *warnings* that are
	// NOT failures. The pass/fail criterion is the AssertTrue below. Ignore
	// warning-level log output; genuine Error-level output still fails the run.
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
}

void AVSEnemyAttackTest::PrepareTest()
{
	Super::PrepareTest();
	PhaseTime = 0.f;
}

void AVSEnemyAttackTest::StartTest()
{
	Super::StartTest();

	Player = Cast<AARPGPlayerCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));

	for (TActorIterator<AARPGEnemyCharacter> It(GetWorld()); It; ++It)
	{
		Enemy = *It;
		break;
	}

	if (!Player.IsValid() || !Enemy.IsValid())
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Player or Enemy missing in the test map"));
		return;
	}

	UAbilitySystemComponent* PlayerASC = Player->GetAbilitySystemComponent();
	if (!PlayerASC)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Player has no AbilitySystemComponent"));
		return;
	}
	PlayerStartHealth = PlayerASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());

	// Teleport the player squarely into the enemy's front arc, within AttackRange,
	// so the enemy's attack lands deterministically without depending on chase
	// movement. PerformFrontArcDamage uses the enemy's forward vector; the
	// controller re-faces the enemy toward the player each tick, keeping the
	// player in-arc.
	const FVector EnemyLoc = Enemy->GetActorLocation();
	const FVector EnemyFwd = Enemy->GetActorForwardVector();
	const float PlaceDist = Enemy->GetAttackRange() * 0.5f;
	Player->SetActorLocation(EnemyLoc + EnemyFwd * PlaceDist, false, nullptr, ETeleportType::TeleportPhysics);
}

void AVSEnemyAttackTest::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!IsRunning() || !Player.IsValid())
	{
		return;
	}

	PhaseTime += DeltaSeconds;

	// Give the controller time to activate the attack (immediate first attack +
	// 0.3s fallback window) and the GE to apply. Assert early to minimise any
	// passive-regen window.
	if (PhaseTime >= 1.5f)
	{
		UAbilitySystemComponent* PlayerASC = Player->GetAbilitySystemComponent();
		if (PlayerASC)
		{
			const float HealthNow = PlayerASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
			AssertTrue(HealthNow < PlayerStartHealth,
				FString::Printf(TEXT("player should have taken damage from the enemy: start=%.1f now=%.1f"),
					PlayerStartHealth, HealthNow));
		}
		else
		{
			AssertTrue(false, TEXT("player has no ASC at health check"));
		}

		FinishTest(EFunctionalTestResult::Default, TEXT("enemy attack verified — player took damage"));
	}
}
```

- [ ] **Step 3: Confirm player header path**

`#include "Player/ARPGPlayerCharacter.h"` matches `VSFunctionalTest.cpp` line 2. If the build later errors on this include, grep for the actual `AARPGPlayerCharacter` header location and correct it.

---

## Task 4: Build the editor target

**Files:** none (compiles Tasks 1–3).

- [ ] **Step 1: Build `PoFEditor`**

Run:
```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex -FromMsBuild
```
Expected: `Build succeeded`. If the `-FromMsBuild` flag is unrecognised on this UE install, drop it. If `Build.bat` is missing, use the project's prior build invocation (`RunUAT BuildEditor` or the UBT exe) — match whatever PS-1/HUD/Characters used.

- [ ] **Step 2: Fix compile errors if any**

Most likely culprits: a wrong include path (`ARPGPlayerCharacter.h`), or `GetCurrentMontage()` signature drift. Fix inline and rebuild until `Build succeeded`.

- [ ] **Step 3: Commit the C++ (UE repo)**

```powershell
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Source/PoF/AI/ARPGSimpleAIController.h Source/PoF/AI/ARPGSimpleAIController.cpp Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.h Source/PoF/AbilitySystem/GA_EnemyMeleeAttack.cpp Source/PoF/Test/VSEnemyAttackTest.h Source/PoF/Test/VSEnemyAttackTest.cpp
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(ai): pure-C++ ARPGSimpleAIController + enemy melee gray-box fallback + AVSEnemyAttackTest"
```

---

## Task 5: `setup_enemy_ai.py` — wire `BP_VSEnemy` + build the test map

**Files:**
- Create: `Content/Python/setup_enemy_ai.py`

Two responsibilities: (1) edit the `BP_VSEnemy` CDO — set `AIControllerClass` to the simple controller and append the enemy melee ability to `GrantedAbilities`; (2) build an isolated `/Game/Maps/VSEnemyAttack` map (floor + lights + player start + a `BP_VSEnemy` + the `AVSEnemyAttackTest` actor). The project's `GlobalDefaultGameMode` (already `BP_VSGameMode`) spawns the player at the PlayerStart. Idempotent like the existing scripts; logs to a sidecar file.

- [ ] **Step 1: Write the script**

`Content/Python/setup_enemy_ai.py`:

```python
"""
setup_enemy_ai.py
=================
Makes the vertical-slice enemy hostile and builds an isolated functional-test map.

1. BP_VSEnemy CDO:
     - AIControllerClass -> AARPGSimpleAIController (pure-C++ chase+attack controller)
     - GrantedAbilities  += UGA_EnemyMeleeAttack (raw C++ class; DamageEffect defaults
       to GE_Damage in C++, so no config-BP is needed)
   (AutoPossessAI is already PlacedInWorldOrSpawned on the C++ class.)
2. /Game/Maps/VSEnemyAttack: floor, lights, PlayerStart, a placed BP_VSEnemy, and an
   AVSEnemyAttackTest actor. The project's GlobalDefaultGameMode spawns BP_VSPlayer.

Idempotent: re-running reuses/overwrites. Run headless:
    "C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe" ^
        "C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject" ^
        -run=pythonscript -script="<abs path to this file>" -unattended -nopause
"""

import unreal

# --- Constants -------------------------------------------------------------
BP_VSENEMY_PATH = "/Game/VerticalSlice/BP_VSEnemy"
TEST_LEVEL_PATH = "/Game/Maps/VSEnemyAttack"

CLS_SIMPLE_AI = "/Script/PoF.ARPGSimpleAIController"
CLS_GA_ENEMY_MELEE = "/Script/PoF.GA_EnemyMeleeAttack"
CLS_ENEMY_ATTACK_TEST = "/Script/PoF.VSEnemyAttackTest"

CUBE_MESH = "/Engine/BasicShapes/Cube"

asset_lib = unreal.EditorAssetLibrary
_PROGRESS = []


def _log(msg):
    unreal.log_warning("[setup_enemy_ai] " + msg)
    _PROGRESS.append(msg)


def load_class(class_path):
    cls = unreal.load_class(None, class_path)
    if cls is None:
        cls = unreal.load_class(None, class_path + "_C")
    return cls


def load_object(object_path):
    if not asset_lib.does_asset_exist(object_path):
        return None
    return asset_lib.load_asset(object_path)


def get_cdo(bp):
    gen = bp.generated_class()
    if gen is None:
        raise RuntimeError("Blueprint has no generated class: " + bp.get_name())
    return unreal.get_default_object(gen)


# --- Section 1: wire BP_VSEnemy CDO ---------------------------------------

def wire_enemy_blueprint():
    try:
        _log("--- Wiring BP_VSEnemy ---")
        bp = load_object(BP_VSENEMY_PATH)
        if bp is None:
            raise RuntimeError("BP_VSEnemy not found: " + BP_VSENEMY_PATH)

        simple_ai = load_class(CLS_SIMPLE_AI)
        if simple_ai is None:
            raise RuntimeError("Could not load " + CLS_SIMPLE_AI + " (rebuild the editor?)")

        ga_melee = load_class(CLS_GA_ENEMY_MELEE)
        if ga_melee is None:
            raise RuntimeError("Could not load " + CLS_GA_ENEMY_MELEE)

        # Ensure the generated class is current before editing the CDO.
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
        cdo = get_cdo(bp)

        cdo.set_editor_property("AIControllerClass", simple_ai)
        _log("BP_VSEnemy: AIControllerClass -> ARPGSimpleAIController")

        granted = cdo.get_editor_property("GrantedAbilities")
        granted = list(granted) if granted else []
        if ga_melee not in granted:
            granted.append(ga_melee)
        cdo.set_editor_property("GrantedAbilities", granted)
        _log("BP_VSEnemy: GrantedAbilities -> %d entry(ies)" % len(granted))

        asset_lib.save_asset(BP_VSENEMY_PATH)
        _log("BP_VSEnemy: saved")
    except Exception as exc:
        unreal.log_error("[setup_enemy_ai] wire_enemy_blueprint FAILED: " + str(exc))
        raise


# --- Section 2: build the isolated test map -------------------------------

def build_test_level():
    try:
        _log("--- Building test level %s ---" % TEST_LEVEL_PATH)
        level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

        # Fresh level (idempotent): switch off the target level before deleting it.
        if asset_lib.does_asset_exist(TEST_LEVEL_PATH):
            level_subsystem.new_level("/Temp/_enemyai_scratch")
            asset_lib.delete_asset(TEST_LEVEL_PATH)
            _log("Deleted prior test level for clean rebuild")

        if not level_subsystem.new_level(TEST_LEVEL_PATH):
            raise RuntimeError("new_level failed for " + TEST_LEVEL_PATH)

        cube_mesh = load_object(CUBE_MESH)
        if cube_mesh is None:
            raise RuntimeError("Cube mesh missing: " + CUBE_MESH)

        # Floor
        floor = actor_subsystem.spawn_actor_from_class(
            unreal.StaticMeshActor, unreal.Vector(0.0, 0.0, 0.0))
        floor.set_actor_label("Floor")
        floor.set_actor_scale3d(unreal.Vector(40.0, 40.0, 1.0))
        floor_smc = floor.static_mesh_component
        floor_smc.set_editor_property("static_mesh", cube_mesh)
        floor_smc.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
        floor_smc.set_mobility(unreal.ComponentMobility.STATIC)

        # Lights
        actor_subsystem.spawn_actor_from_class(
            unreal.DirectionalLight, unreal.Vector(0.0, 0.0, 1000.0),
            unreal.Rotator(-45.0, 0.0, 0.0)).set_actor_label("DirectionalLight")
        actor_subsystem.spawn_actor_from_class(
            unreal.SkyLight, unreal.Vector(0.0, 0.0, 1000.0)).set_actor_label("SkyLight")

        # Player start
        actor_subsystem.spawn_actor_from_class(
            unreal.PlayerStart, unreal.Vector(0.0, 0.0, 150.0)).set_actor_label("PlayerStart")

        # Enemy (wired BP_VSEnemy) — within ~300uu so it's near the player.
        bp_enemy = load_object(BP_VSENEMY_PATH)
        enemy_cls = bp_enemy.generated_class() if bp_enemy else None
        if enemy_cls is None:
            raise RuntimeError("BP_VSEnemy has no generated class")
        actor_subsystem.spawn_actor_from_class(
            enemy_cls, unreal.Vector(300.0, 0.0, 150.0)).set_actor_label("VSEnemy")

        # Functional test actor
        test_cls = load_class(CLS_ENEMY_ATTACK_TEST)
        if test_cls is None:
            raise RuntimeError("Could not load " + CLS_ENEMY_ATTACK_TEST)
        actor_subsystem.spawn_actor_from_class(
            test_cls, unreal.Vector(0.0, 0.0, 200.0)).set_actor_label("VSEnemyAttackTest")

        level_subsystem.save_current_level()
        _log("Saved test level: " + TEST_LEVEL_PATH)
    except Exception as exc:
        unreal.log_error("[setup_enemy_ai] build_test_level FAILED: " + str(exc))
        raise


def main():
    _log("=== enemy AI wiring START ===")
    wire_enemy_blueprint()
    build_test_level()
    _log("=== enemy AI wiring COMPLETE ===")

    try:
        out_path = unreal.Paths.combine(
            [unreal.Paths.project_saved_dir(), "setup_enemy_ai.log"])
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(_PROGRESS) + "\n")
        unreal.log_warning("[setup_enemy_ai] progress written to " + out_path)
    except Exception as exc:
        unreal.log_error("[setup_enemy_ai] could not write progress log: " + str(exc))


if __name__ == "__main__":
    main()
```

---

## Task 6: Run the wiring script

**Files:** none.

- [ ] **Step 1: Run headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\setup_enemy_ai.py" -unattended -nopause -nosplash
```

- [ ] **Step 2: Verify the sidecar log**

Read `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\setup_enemy_ai.log`. Expected lines: `AIControllerClass -> ARPGSimpleAIController`, `GrantedAbilities -> 1 entry(ies)` (or more), `Saved test level: /Game/Maps/VSEnemyAttack`, `=== enemy AI wiring COMPLETE ===`. If a level op crashed, re-run with the full-editor form:
```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\setup_enemy_ai.py" -unattended -nopause -nosplash
```

---

## Task 7: Run `AVSEnemyAttackTest` (the deliverable's gate)

**Files:** none.

- [ ] **Step 1: Run the test headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VSEnemyAttack.VSEnemyAttackTest; Quit" -unattended -nopause -nosplash -nullrhi -NoSound -log -abslog="C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\enemyattack_test.log"
```

- [ ] **Step 2: Verify the result from the log**

Read `Saved\enemyattack_test.log`. Expected: a line containing `Result={Success}` for `VSEnemyAttackTest` (and the assert message `enemy attack verified — player took damage`). **Judge by log content, not exit code** (benign exit-3 on shutdown). If `Result={Failure}`:
- "Player or Enemy missing" → the global game mode didn't spawn the player (check `DefaultEngine.ini` `GlobalDefaultGameMode`) or the enemy wasn't placed (re-run Task 6).
- Health unchanged → the ability didn't activate or didn't damage. Add `UE_LOG` in the controller's attack branch and in `PerformFrontArcDamage`; confirm the granted ability's asset tag is `Ability.Enemy.Melee` and the controller's `AttackAbilityTag` matches; confirm the player is in the front arc (the teleport math).

---

## Task 8: Re-run the PS-1 functional test (regression gate)

**Files:** none.

- [ ] **Step 1: Run PS-1 headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest; Quit" -unattended -nopause -nosplash -nullrhi -NoSound -log -abslog="C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\ps1_rerun.log"
```

- [ ] **Step 2: Verify PS-1 still green**

Read `Saved\ps1_rerun.log`. Expected: `Result={Success}` with criteria #2–#5 all asserting true. The now-hostile slice enemy is at (400,0,150); the player starts at (0,0,150) and moves forward in phase 0 — they stay >`AttackRange` (200) apart and the enemy has no nav volume in the slice map, so on the bare slice the enemy steers toward the player but the PS-1 test completes (~6.5 s) before any enemy hit threatens the player's run. If PS-1 regresses because the enemy reaches and damages the player enough to disturb a criterion, the fix is to lower the slice enemy's effective threat for the test window (e.g., spawn the PS-1 enemy farther, or gate the controller's chase) — but first confirm the actual failing criterion from the log.

---

## Task 9 (optional, confirmatory): real-launch screenshot

**Files:** none. Skip if time-boxed — Tasks 7–8 are the hard gates.

- [ ] **Step 1: Launch the test map windowed + screenshot**

Launch `/Game/Maps/VSEnemyAttack` with `UnrealEditor.exe ... -game` windowed, let it settle a few seconds (the enemy chases the spawned player), `HighResShot`. Then run the project's `gemini-recognize.mjs` check (personas `.env`) with a discriminating prompt: *"Is the red enemy character moving toward / next to the player character (not standing far away)? Answer yes or no."* Expected: yes. This is qualitative confirmation of the chase; the functional test is authoritative for damage.

---

## Task 10: Commit + findings

**Files:**
- Modify (app repo): `docs/improvements/02-character/README.md` or a findings note (append outcome).

- [ ] **Step 1: Commit UE changes (already partly done in Task 4)**

Commit the Python script + any regenerated assets (the `.umap`, the modified `BP_VSEnemy.uasset`) to the UE repo:
```powershell
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Content/Python/setup_enemy_ai.py Content/VerticalSlice/BP_VSEnemy.uasset Content/Maps/VSEnemyAttack.umap
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(slice): hostile enemy AI + player-takes-damage; VSEnemyAttack test map"
```
(Binary `.uasset`/`.umap` go through Git LFS — already configured in this repo.)

- [ ] **Step 2: Record findings in the app repo**

Append a short outcome to `docs/improvements/02-character/` (what shipped: the controller, the ability fallback, the test; the activation-tag mismatch discovered; the nav-independent steering decision; PS-1 re-run result). Commit to the app repo (local only):
```powershell
git -C "C:\Users\kazda\kiro\pof" add docs/improvements/02-character/ docs/superpowers/plans/2026-05-23-character-enemy-ai.md
git -C "C:\Users\kazda\kiro\pof" commit -m "docs(character): enemy-AI deliverable plan + outcome"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 `AARPGSimpleAIController` → Task 1 (steering refined to nav-independent `AddMovementInput`, an improvement over `MoveToActor`; documented).
- Spec §2 `GA_EnemyMeleeAttack` gray-box fallback → Task 2 (mirrors `GA_MeleeAttack` exactly; verified against the real source).
- Spec §3 `BP_VSEnemy` wiring → Task 5/6 (config-BP eliminated by defaulting `DamageEffect` in C++ — simpler than the spec's `BP_GA_EnemyMeleeAttack`; `AutoPossessAI` already correct, so not re-set; `PrimaryAbilityTag` left alone because the controller activates by the ability's own `Ability.Enemy.Melee` asset tag, resolving the spec's "confirm at plan time" tag question).
- Spec §4 verification → Tasks 7 (`AVSEnemyAttackTest`) + 8 (PS-1 re-run) + 9 (optional Gemini).
- Spec risks: double-apply → `bDamageApplied` guard (Task 2 Step 7); active enemy disturbs PS-1 → Task 8 gate; `AutoPossessAI` → already set; **NavMesh risk eliminated** by direct steering; `AIModule` → already in `PoF.Build.cs` (no edit).

**Placeholder scan:** none — all code is complete; all commands are concrete with expected output and named failure modes.

**Type consistency:** controller uses `AttackAbilityTag` (= `Ability_Enemy_Melee`) consistently; ability uses `bUsingFallbackWindow` / `bDamageApplied` / `FallbackAttackWindow` / `OnFallbackWindowElapsed` consistently between header and cpp; test uses `PlayerStartHealth` / `PhaseTime` consistently. Methods called on `AARPGEnemyCharacter` (`GetAttackRange`, `GetAttackCooldown`, `IsDead`, `GetAbilitySystemComponent`, `AddMovementInput`, `SetActorRotation`) are all verified to exist/be public.

**Deviations from spec (intentional, lower-risk):** (1) direct steering instead of `MoveToActor` — removes the NavMesh dependency; (2) `DamageEffect` defaulted in C++ instead of a config-BP — fewer assets, grant the raw class; (3) isolated `/Game/Maps/VSEnemyAttack` map instead of adding a second test actor to the slice map — avoids cross-test world-state contamination.
