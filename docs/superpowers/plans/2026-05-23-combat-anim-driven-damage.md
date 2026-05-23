# Combat-1 · `bUseAnimationDrivenDamage` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `UGA_MeleeAttack` deal melee damage in a gray-box project deterministically (no hit-detection AnimNotify required) via a `bUseAnimationDrivenDamage=false` default, with a single-flag switch to the animation-driven path.

**Architecture:** Add a mode flag + two tuning props to `UGA_MeleeAttack`. Extract the existing forward-cone target search (from `AcquireWarpTarget`) and the GE-build-and-apply body (from `OnMeleeHit`) into reusable methods. In `false` mode, a short `WaitDelay` fires a self-resolved forward-cone hit at a deterministic mid-swing offset. Prove it with a new self-contained `AFunctionalTest` (`VSCombatGrayBoxPathTest`) that activates the ability with the enemy in range and asserts damage **without** sending `Event.MeleeHit`. A second test asserts the melee ability is granted on the player ASC.

**Tech Stack:** UE 5.7 C++ (GAS: `UGameplayAbility`, `UAbilityTask_WaitDelay`, `FGameplayEffectSpec`, `AFunctionalTest`), UE Python (editor actor placement), Next.js/TS (PoF app prompt default).

**Spec:** `docs/superpowers/specs/2026-05-23-combat-anim-driven-damage-design.md`

---

## Ground truth (read before starting)

- **UE repo:** `C:\Users\kazda\Documents\Unreal Projects\PoF` → pushes to `github.com/xkazm04/pof-exp` (pushes work here).
- **App repo:** `C:\Users\kazda\kiro\pof` → commit **locally only**, do **not** push (kazimi66 403s on xkazm04/pof; user pushes manually).
- **Engine:** `C:\Program Files\Epic Games\UE_5.7\Engine`. Editor target: `PoFEditor`.
- **The player's granted melee ability is `BP_GA_MeleeAttack`** (`/Game/Abilities/BP_GA_MeleeAttack`), a Blueprint subclass of the C++ `UGA_MeleeAttack`. New C++ UPROPERTYs added here propagate to that BP as inherited CDO defaults — **no Blueprint edit needed** for `bUseAnimationDrivenDamage=false`.
- **Shared-tree coordination:** sibling forks have *uncommitted* `Source/PoF/Test/ARPGFunctionalTestBase.{h,cpp}`, `Source/PoF/Test/HealthCheck/`, `Source/PoF/Debug/ARPGVerifyCommands.cpp`. Combat-1 does **not** depend on or edit these, and does **not** edit `Source/PoF/Test/VSFunctionalTest.cpp`. If a build fails inside those uncommitted sibling files, that is a sibling's compile error — not Combat-1's; flag it and stop rather than "fixing" their file.
- **Slice geometry:** PlayerStart `(0,0,150)`, enemy `(400,0,150)` — 400 cm apart, so the gray-box test must reposition the player.

### Existing helpers/values (do not redefine)

- `UGA_MeleeAttack` already has: `AttackMontage`, `ComboSectionNames`, `MontagePlayRate`, `DamageEffect`, `BaseDamage=20`, `ComboDamageMultipliers`, `FallbackAttackWindow=0.5`, motion-warp props (`bEnableAttackMagnetism=true`, `WarpTargetSearchRadius=400`, `WarpTargetSearchAngle=60`, `WarpTargetName`, `WarpStopDistance=100`), `CurrentComboIndex`, `bUsingFallbackWindow`, and methods `StartMontageAndListenForCombo()`, `ListenForComboWindow()`, `OnMeleeHit(FGameplayEventData)`, `AcquireWarpTarget()`, `GetARPGCharacter()`, `GetARPGAbilitySystemComponent()`.
- Gameplay tags (in `ARPGGameplayTags`): `Ability_Melee_LightAttack`, `Event_MeleeHit`, `Data_Damage_Base`, `Damage_Physical`, `State_Dead`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `Source/PoF/AbilitySystem/GA_MeleeAttack.h` (modify) | Declare `bUseAnimationDrivenDamage`, `GrayBoxHitDelay`, `MeleeHitRange` + `OnGrayBoxHitWindow()`, `FindForwardTarget()`, `ApplyMeleeDamageTo()`. |
| `Source/PoF/AbilitySystem/GA_MeleeAttack.cpp` (modify) | Extract `FindForwardTarget`/`ApplyMeleeDamageTo`; schedule the `false`-mode self-apply WaitDelay. |
| `Source/PoF/Test/Combat/VSCombatGrayBoxPathTest.{h,cpp}` (create) | Functional test: gray-box damage applies with no event send. |
| `Source/PoF/Test/Combat/VSCombatAbilityGrantTest.{h,cpp}` (create) | Functional test: melee ability granted on player ASC. |
| `Content/Python/place_combat_tests.py` (create) | Idempotent: place both test actors in VerticalSlice map + save. |
| `src/lib/module-registry.ts` (modify, app repo) | `arpg-combat` `acb-1` prompt default carries the gray-box damage guidance. |

---

## Task 1: Write the two functional-test classes (the tests)

These are written first (TDD). After Task 2's build+place+run, `VSCombatGrayBoxPathTest` is expected to FAIL (current code applies damage only on `Event.MeleeHit`, which the test never sends), while `VSCombatAbilityGrantTest` PASSES (the melee ability is already granted today).

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\Test\Combat\VSCombatGrayBoxPathTest.h`
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\Test\Combat\VSCombatGrayBoxPathTest.cpp`
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\Test\Combat\VSCombatAbilityGrantTest.h`
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\Test\Combat\VSCombatAbilityGrantTest.cpp`

- [ ] **Step 1: Write `VSCombatGrayBoxPathTest.h`**

```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSCombatGrayBoxPathTest.generated.h"

class AARPGPlayerCharacter;
class AARPGEnemyCharacter;

/**
 * Gray-box melee damage path: with bUseAnimationDrivenDamage=false (the default),
 * activating GA_MeleeAttack with an enemy in front must damage that enemy WITHOUT
 * the test sending Event.MeleeHit. Guards the in-game hit path the empty montage
 * cannot exercise.
 */
UCLASS()
class POF_API AVSCombatGrayBoxPathTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSCombatGrayBoxPathTest();

	virtual void PrepareTest() override;
	virtual void StartTest() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	TWeakObjectPtr<AARPGPlayerCharacter> Player;
	TWeakObjectPtr<AARPGEnemyCharacter>  Enemy;

	int32 Phase = 0;
	float PhaseTime = 0.f;
	float EnemyStartHealth = 0.f;
};
```

- [ ] **Step 2: Write `VSCombatGrayBoxPathTest.cpp`**

```cpp
#include "Test/Combat/VSCombatGrayBoxPathTest.h"
#include "Player/ARPGPlayerCharacter.h"
#include "Character/ARPGEnemyCharacter.h"
#include "AbilitySystem/ARPGAttributeSet.h"
#include "AbilitySystem/ARPGGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "GameplayTagContainer.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"

AVSCombatGrayBoxPathTest::AVSCombatGrayBoxPathTest()
{
	PrimaryActorTick.bCanEverTick = true;
	TimeLimit = 20.f;
	// Gray-box slice: incidental anim/montage warnings are not failures.
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
}

void AVSCombatGrayBoxPathTest::PrepareTest()
{
	Super::PrepareTest();
	Phase = 0;
	PhaseTime = 0.f;
}

void AVSCombatGrayBoxPathTest::StartTest()
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
		FinishTest(EFunctionalTestResult::Failed, TEXT("Player or Enemy missing in the slice level"));
	}
}

void AVSCombatGrayBoxPathTest::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!IsRunning() || !Player.IsValid() || !Enemy.IsValid())
	{
		return;
	}

	PhaseTime += DeltaSeconds;

	// Phase 0 — reposition the player into melee range, facing the enemy, and
	// record the enemy's start health. The slice spawns them 400cm apart, which
	// is outside MeleeHitRange (180cm), so we must close the distance.
	if (Phase == 0)
	{
		const FVector EnemyLoc = Enemy->GetActorLocation();
		const FVector ToEnemy = EnemyLoc - Player->GetActorLocation();
		const FVector Dir = ToEnemy.GetSafeNormal2D();
		const FVector StandLoc = EnemyLoc - Dir * 150.f; // 150cm < 180cm MeleeHitRange

		Player->SetActorLocation(
			FVector(StandLoc.X, StandLoc.Y, Player->GetActorLocation().Z),
			false, nullptr, ETeleportType::TeleportPhysics);
		Player->SetActorRotation(Dir.Rotation());

		if (UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent())
		{
			EnemyStartHealth = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
		}

		if (PhaseTime >= 0.2f)
		{
			Phase = 1;
			PhaseTime = 0.f;
		}
		return;
	}

	// Phase 1 — activate the melee ability. Crucially, we do NOT send Event.MeleeHit.
	if (Phase == 1)
	{
		if (PhaseTime <= DeltaSeconds + KINDA_SMALL_NUMBER)
		{
			UAbilitySystemComponent* PlayerASC = Player->GetAbilitySystemComponent();
			if (!PlayerASC)
			{
				FinishTest(EFunctionalTestResult::Failed, TEXT("Player has no AbilitySystemComponent"));
				return;
			}

			FGameplayTagContainer MeleeTag;
			MeleeTag.AddTag(ARPGGameplayTags::Ability_Melee_LightAttack);
			const bool bActivated = PlayerASC->TryActivateAbilitiesByTag(MeleeTag);
			AssertTrue(bActivated, TEXT("gray-box: melee ability should have activated"));
		}

		// GrayBoxHitDelay is 0.2s; wait 1.0s to cover the self-applied hit + GE propagation.
		if (PhaseTime >= 1.0f)
		{
			Phase = 2;
			PhaseTime = 0.f;
		}
		return;
	}

	// Phase 2 — assert the enemy took damage from the SELF-APPLIED gray-box hit,
	// with no Event.MeleeHit ever sent by this test.
	if (Phase == 2)
	{
		if (PhaseTime >= 0.5f)
		{
			if (UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent())
			{
				const float HealthNow = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
				AssertTrue(HealthNow < EnemyStartHealth,
					FString::Printf(TEXT("gray-box damage: enemy Health should drop from %.1f via the self-applied hit (no Event.MeleeHit sent), is %.1f"),
						EnemyStartHealth, HealthNow));
			}
			else
			{
				AssertTrue(false, TEXT("gray-box damage: enemy has no ASC to read Health from"));
			}

			FinishTest(EFunctionalTestResult::Default, TEXT("gray-box damage path verified"));
		}
		return;
	}
}
```

- [ ] **Step 3: Write `VSCombatAbilityGrantTest.h`**

```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSCombatAbilityGrantTest.generated.h"

/**
 * Asserts the player ASC has abilities granted on possession, and specifically
 * that GA_MeleeAttack (or a Blueprint subclass of it) is among them. Forward-compatible
 * with sub-project (2)'s ability-roster expansion.
 */
UCLASS()
class POF_API AVSCombatAbilityGrantTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSCombatAbilityGrantTest();

	virtual void StartTest() override;
};
```

- [ ] **Step 4: Write `VSCombatAbilityGrantTest.cpp`**

```cpp
#include "Test/Combat/VSCombatAbilityGrantTest.h"
#include "Player/ARPGPlayerCharacter.h"
#include "AbilitySystem/GA_MeleeAttack.h"
#include "AbilitySystemComponent.h"
#include "Abilities/GameplayAbility.h"
#include "Kismet/GameplayStatics.h"

AVSCombatAbilityGrantTest::AVSCombatAbilityGrantTest()
{
	TimeLimit = 10.f;
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
}

void AVSCombatAbilityGrantTest::StartTest()
{
	Super::StartTest();

	AARPGPlayerCharacter* PlayerChar = Cast<AARPGPlayerCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
	if (!PlayerChar)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("No player character"));
		return;
	}

	UAbilitySystemComponent* ASC = PlayerChar->GetAbilitySystemComponent();
	if (!ASC)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Player has no AbilitySystemComponent"));
		return;
	}

	const TArray<FGameplayAbilitySpec>& Specs = ASC->GetActivatableAbilities();
	AssertTrue(Specs.Num() > 0,
		FString::Printf(TEXT("ability grant: player should have >=1 ability granted, has %d"), Specs.Num()));

	bool bHasMelee = false;
	for (const FGameplayAbilitySpec& Spec : Specs)
	{
		if (Spec.Ability && Spec.Ability->IsA(UGA_MeleeAttack::StaticClass()))
		{
			bHasMelee = true;
			break;
		}
	}
	AssertTrue(bHasMelee, TEXT("ability grant: GA_MeleeAttack should be granted to the player ASC"));

	FinishTest(EFunctionalTestResult::Default, TEXT("ability grant verified"));
}
```

- [ ] **Step 5: Commit (UE repo)**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/Test/Combat/VSCombatGrayBoxPathTest.h Source/PoF/Test/Combat/VSCombatGrayBoxPathTest.cpp Source/PoF/Test/Combat/VSCombatAbilityGrantTest.h Source/PoF/Test/Combat/VSCombatAbilityGrantTest.cpp
git commit -m "test(combat): gray-box damage path + ability-grant functional tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: First build + place + run (expect RED on gray-box)

Confirms the test harness is wired and that the gray-box damage path is genuinely missing today.

**Files:** none modified (build/run only). Run all commands from PowerShell.

- [ ] **Step 1: Build the editor target**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```

Expected: `BUILD SUCCESSFUL`. If the build fails inside a sibling's uncommitted file (`ARPGFunctionalTestBase.*`, `HealthCheck/*`, `Debug/ARPGVerifyCommands.cpp`), STOP and flag it — do not edit sibling files. If it fails in `VSCombatGrayBoxPathTest.cpp`/`VSCombatAbilityGrantTest.cpp`, fix the test code and rebuild.

- [ ] **Step 2: Write the placement script** (`Content/Python/place_combat_tests.py`)

```python
"""
place_combat_tests.py
=====================
Idempotent: places the Combat-1 functional-test actors in the VerticalSlice map
and saves. Run headless (after the C++ classes are compiled):

    "C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe" ^
        "C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject" ^
        -run=pythonscript -script="<abs path to this file>" -unattended -nopause
"""

import unreal

LEVEL_PATH = "/Game/Maps/VerticalSlice"

# (class /Script path, actor label, spawn location)
TESTS = [
    ("/Script/PoF.VSCombatGrayBoxPathTest", "VSCombatGrayBoxPathTest", unreal.Vector(0.0, 0.0, 220.0)),
    ("/Script/PoF.VSCombatAbilityGrantTest", "VSCombatAbilityGrantTest", unreal.Vector(0.0, 0.0, 240.0)),
]


def main():
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    aes = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    if not les.load_level(LEVEL_PATH):
        raise RuntimeError("Failed to load level " + LEVEL_PATH)

    existing = {a.get_actor_label() for a in aes.get_all_level_actors()}

    for cls_path, label, loc in TESTS:
        if label in existing:
            unreal.log("[place_combat_tests] already present, skipping: " + label)
            continue
        cls = unreal.load_class(None, cls_path)
        if cls is None:
            raise RuntimeError("Could not load class " + cls_path)
        actor = aes.spawn_actor_from_class(cls, loc)
        actor.set_actor_label(label)
        unreal.log("[place_combat_tests] placed: " + label)

    les.save_current_level()
    unreal.log("[place_combat_tests] saved level " + LEVEL_PATH)


main()
```

- [ ] **Step 3: Run the placement script**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\place_combat_tests.py" -unattended -nopause
```

Expected log lines: `[place_combat_tests] placed: VSCombatGrayBoxPathTest`, `placed: VSCombatAbilityGrantTest`, `saved level /Game/Maps/VerticalSlice`.

- [ ] **Step 4: Run the gray-box test (expect FAIL)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSCombatGrayBoxPathTest;Quit" -unattended -nopause -nullrhi -log
```

Expected: log shows `Assertion failed (gray-box damage: enemy Health should drop ...)` and `Result={Failure} Name={VSCombatGrayBoxPathTest}` — because no code applies damage without `Event.MeleeHit` yet. (Headless UE may exit non-zero on teardown; judge from the log, not the exit code.)

- [ ] **Step 5: Run the ability-grant test (expect PASS)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSCombatAbilityGrantTest;Quit" -unattended -nopause -nullrhi -log
```

Expected: `Result={Success} Name={VSCombatAbilityGrantTest}` (the melee ability is already granted today).

- [ ] **Step 6: Commit the placement script (UE repo)**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/Python/place_combat_tests.py
git commit -m "test(combat): place combat functional-test actors in the slice map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add the new properties + method declarations to the header

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\AbilitySystem\GA_MeleeAttack.h`

- [ ] **Step 1: Add the three UPROPERTYs** — place them with the other combat properties, immediately after the `ComboDamageMultipliers` UPROPERTY:

```cpp
	/**
	 * When false (default, gray-box: empty montage or no hit-detection notify), the
	 * ability resolves its own forward melee target and applies damage at a deterministic
	 * mid-swing offset — no AnimNotify required. When true, the ability skips the
	 * self-apply and relies on the montage's hit-detection notify firing Event.MeleeHit.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat|Damage")
	bool bUseAnimationDrivenDamage = false;

	/** Seconds into the swing the gray-box self-applied hit lands (false mode only). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat|Damage", meta = (ClampMin = "0.0"))
	float GrayBoxHitDelay = 0.2f;

	/** Forward melee reach (cm) for the gray-box target search. Distinct from the warp radius. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat|Damage", meta = (ClampMin = "0.0"))
	float MeleeHitRange = 180.f;
```

- [ ] **Step 2: Add the three method declarations** — in the `private:` section, alongside the other private methods (e.g., after the `OnFallbackWindowElapsed` / `AcquireWarpTarget` declarations):

```cpp
	/** WaitDelay callback: in gray-box (false) mode, resolve a forward target and apply the hit. */
	UFUNCTION()
	void OnGrayBoxHitWindow();

	/** Forward-cone search for the nearest live combatant. Shared by warp + gray-box hit. */
	AActor* FindForwardTarget(float Range, float HalfAngleDeg);

	/** Build + apply the damage GameplayEffect to a resolved target (shared by both paths). */
	void ApplyMeleeDamageTo(AActor* Target, const FHitResult* OptionalHit);
```

- [ ] **Step 3: Verify the header parses** — visual check only (full build happens in Task 5). Confirm: `bUseAnimationDrivenDamage`, `GrayBoxHitDelay`, `MeleeHitRange` are inside the `UCLASS` body; the three method decls are under `private:`; `OnGrayBoxHitWindow` has the `UFUNCTION()` macro (required for `AddDynamic`).

---

## Task 4: Implement the refactors + the gray-box self-apply branch

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\AbilitySystem\GA_MeleeAttack.cpp`

- [ ] **Step 1: Extract `FindForwardTarget` and rewrite `AcquireWarpTarget` to call it.** Replace the entire existing `AcquireWarpTarget()` body (the overlap-sphere + cone + alive-check + nearest loop, then the warp-location math) with these two functions:

```cpp
AActor* UGA_MeleeAttack::FindForwardTarget(float Range, float HalfAngleDeg)
{
	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character) return nullptr;

	UWorld* World = Character->GetWorld();
	if (!World) return nullptr;

	const FVector Origin = Character->GetActorLocation();
	const FVector Forward = Character->GetActorForwardVector();
	const float CosHalfAngle = FMath::Cos(FMath::DegreesToRadians(HalfAngleDeg));

	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(Character);

	TArray<FOverlapResult> Overlaps;
	World->OverlapMultiByChannel(
		Overlaps,
		Origin,
		FQuat::Identity,
		ECC_Pawn,
		FCollisionShape::MakeSphere(Range),
		QueryParams);

	AActor* BestTarget = nullptr;
	float BestDistSq = MAX_FLT;

	for (const FOverlapResult& Overlap : Overlaps)
	{
		AActor* Candidate = Overlap.GetActor();
		if (!Candidate || Candidate == Character) continue;

		// Must be a combatant (implements AbilitySystemInterface) and alive.
		IAbilitySystemInterface* ASI = Cast<IAbilitySystemInterface>(Candidate);
		if (!ASI) continue;
		if (UAbilitySystemComponent* TargetASC = ASI->GetAbilitySystemComponent())
		{
			if (TargetASC->HasMatchingGameplayTag(ARPGGameplayTags::State_Dead))
			{
				continue;
			}
		}

		const FVector ToTarget = Candidate->GetActorLocation() - Origin;
		const FVector ToTargetDir = ToTarget.GetSafeNormal2D();
		if (FVector::DotProduct(Forward, ToTargetDir) < CosHalfAngle)
		{
			continue;
		}

		const float DistSq = ToTarget.SizeSquared2D();
		if (DistSq < BestDistSq)
		{
			BestDistSq = DistSq;
			BestTarget = Candidate;
		}
	}

	return BestTarget;
}

void UGA_MeleeAttack::AcquireWarpTarget()
{
	if (!bEnableAttackMagnetism) return;

	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character) return;

	AActor* BestTarget = FindForwardTarget(WarpTargetSearchRadius, WarpTargetSearchAngle);
	if (!BestTarget) return;

	const FVector Origin = Character->GetActorLocation();
	const FVector ToTarget = BestTarget->GetActorLocation() - Origin;
	const float Dist = ToTarget.Size2D();

	if (Dist > WarpStopDistance)
	{
		const FVector WarpLocation = BestTarget->GetActorLocation() - ToTarget.GetSafeNormal2D() * WarpStopDistance;
		Character->SetAttackWarpTarget(FVector(WarpLocation.X, WarpLocation.Y, Origin.Z), WarpTargetName);
	}
	else
	{
		// Already close enough — just face the target.
		Character->SetAttackWarpTarget(Origin, WarpTargetName);
	}
}
```

- [ ] **Step 2: Extract `ApplyMeleeDamageTo` and rewrite `OnMeleeHit` to call it.** Replace the entire existing `OnMeleeHit(FGameplayEventData Payload)` body with these two functions:

```cpp
void UGA_MeleeAttack::ApplyMeleeDamageTo(AActor* Target, const FHitResult* OptionalHit)
{
	if (!DamageEffect || !Target) return;

	IAbilitySystemInterface* ASI = Cast<IAbilitySystemInterface>(Target);
	UAbilitySystemComponent* TargetASC = ASI ? ASI->GetAbilitySystemComponent() : nullptr;
	if (!TargetASC) return;

	UAbilitySystemComponent* SourceASC = GetARPGAbilitySystemComponent();
	if (!SourceASC) return;

	FGameplayEffectContextHandle Context = SourceASC->MakeEffectContext();
	Context.AddSourceObject(this);
	if (OptionalHit)
	{
		Context.AddHitResult(*OptionalHit);
	}

	FGameplayEffectSpecHandle SpecHandle = SourceASC->MakeOutgoingSpec(
		DamageEffect, GetAbilityLevel(), Context);
	if (!SpecHandle.IsValid()) return;

	const float ComboMultiplier = ComboDamageMultipliers.IsValidIndex(CurrentComboIndex)
		? ComboDamageMultipliers[CurrentComboIndex]
		: 1.f;

	FGameplayEffectSpec* Spec = SpecHandle.Data.Get();
	Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Damage_Base, BaseDamage * ComboMultiplier);
	Spec->AddDynamicAssetTag(ARPGGameplayTags::Damage_Physical);

	SourceASC->ApplyGameplayEffectSpecToTarget(*Spec, TargetASC);

	UE_LOG(LogTemp, Log, TEXT("[GA_MeleeAttack] Applied damage to %s: Base=%.1f x Combo=%.2f"),
		*Target->GetName(), BaseDamage, ComboMultiplier);
}

void UGA_MeleeAttack::OnMeleeHit(FGameplayEventData Payload)
{
	AActor* HitActor = const_cast<AActor*>(Payload.Target.Get());
	const FHitResult* HitResult = (Payload.TargetData.Num() > 0)
		? Payload.TargetData.Get(0)->GetHitResult()
		: nullptr;
	ApplyMeleeDamageTo(HitActor, HitResult);
}
```

- [ ] **Step 3: Schedule the gray-box self-apply WaitDelay.** In `StartMontageAndListenForCombo()`, immediately after the `ListenForComboWindow();` call and **before** the `bool bCanPlayMontage = false;` line (so it is scheduled regardless of whether the montage-playing branch returns early), insert:

```cpp
	// Gray-box (false) mode: the ability applies its own damage at a deterministic
	// mid-swing offset, resolving a forward melee target itself — no hit-detection
	// AnimNotify required. Scheduled here so it fires whether or not a montage plays.
	if (!bUseAnimationDrivenDamage)
	{
		UAbilityTask_WaitDelay* HitTask = UAbilityTask_WaitDelay::WaitDelay(this, GrayBoxHitDelay);
		HitTask->OnFinish.AddDynamic(this, &UGA_MeleeAttack::OnGrayBoxHitWindow);
		HitTask->ReadyForActivation();
	}
```

- [ ] **Step 4: Implement `OnGrayBoxHitWindow`.** Add this function (e.g., directly after `OnFallbackWindowElapsed`):

```cpp
void UGA_MeleeAttack::OnGrayBoxHitWindow()
{
	// Resolve the melee target ourselves (no Event.MeleeHit / notify in gray-box mode)
	// and apply the damage GE. Reuses the forward-cone search and the shared apply path.
	if (AActor* Target = FindForwardTarget(MeleeHitRange, WarpTargetSearchAngle))
	{
		ApplyMeleeDamageTo(Target, nullptr);
	}
}
```

- [ ] **Step 5: Verify no missing includes** — `UAbilityTask_WaitDelay`, `OverlapResult`, `AbilitySystemInterface`, `GameplayEffect`, `SkeletalMeshComponent`, `Character` are already `#include`d at the top of `GA_MeleeAttack.cpp` (confirmed in ground truth). No new includes needed. Visual check only.

---

## Task 5: Rebuild + re-run (expect GREEN) + regression check

**Files:** none modified (build/run only).

- [ ] **Step 1: Rebuild the editor target**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Run the gray-box test (expect PASS now)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSCombatGrayBoxPathTest;Quit" -unattended -nopause -nullrhi -log
```

Expected: `Assertion passed (gray-box damage: enemy Health should drop ...)` and `Result={Success} Name={VSCombatGrayBoxPathTest}`. If it still FAILS: check the log for `[GA_MeleeAttack] Applied damage to VSEnemy` — if absent, the forward search found no target (the player isn't oriented at / within `MeleeHitRange` of the enemy, or the enemy lacks a Pawn-collision/ASC). If present but Health unchanged, the `DamageEffect`/execution isn't applying — re-check `BP_GA_MeleeAttack` has `DamageEffect` set.

- [ ] **Step 3: Regression — re-run `VSFunctionalTest` (must still PASS)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log
```

Expected: `Result={Success} Name={VSFunctionalTest}`. (Its #4 sends `Event.MeleeHit` AND now the gray-box self-apply also lands — enemy takes more damage, but #4 asserts `Health < EnemyStartHealth`, which still holds. #5 unchanged.)

- [ ] **Step 4: Commit the GA_MeleeAttack changes (UE repo)**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/AbilitySystem/GA_MeleeAttack.h Source/PoF/AbilitySystem/GA_MeleeAttack.cpp
git commit -m "feat(combat): bUseAnimationDrivenDamage toggle on GA_MeleeAttack

False (default, gray-box) self-applies melee damage via a forward-cone
search at a deterministic mid-swing offset, no hit-notify required.
Extracts FindForwardTarget + ApplyMeleeDamageTo as shared helpers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Push the UE repo** (pushes work on `pof-exp`)

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git push
```

---

## Task 6: Update the PoF app prompt default

Make PoF *generate* abilities that deal damage in a gray-box project, with the documented one-flag switch.

**Files:**
- Modify: `C:\Users\kazda\kiro\pof\src\lib\module-registry.ts` (the `acb-1` checklist item, ~line 197)

- [ ] **Step 1: Replace the `acb-1` prompt string.** Find the object with `id: 'acb-1'` and replace its `prompt:` value with:

```
Create a GA_MeleeAttack Gameplay Ability for my aRPG. It should: activate on input, play the attack animation montage using AbilityTask_PlayMontageAndWait, handle combo window via WaitGameplayEvent, allow chaining into next combo section if input received during combo window, and commit mana cost if applicable. Add a `bool bUseAnimationDrivenDamage` property (default false). When false (gray-box: an empty montage or no hit-detection notify yet), the ability resolves its own melee target with a short forward-cone trace and applies the damage GameplayEffect at a deterministic mid-swing offset — so it deals damage WITHOUT depending on a montage AnimNotify. When true (a real montage with a hit-detection AnimNotifyState is in place), skip the self-apply and rely on the notify firing Event.MeleeHit. This makes a gray-box project deal damage out of the box, with a single-flag switch to the animation-driven path once animations land.
```

- [ ] **Step 2: Run the app validation suite**

```powershell
cd "C:\Users\kazda\kiro\pof"
npm run validate
```

Expected: typecheck + lint + tests all pass. (The edit is a single string literal; if any registry snapshot test references `acb-1`'s prompt text, update that snapshot.)

- [ ] **Step 3: Commit (app repo, LOCAL ONLY — do not push)**

```bash
cd "C:\Users\kazda\kiro\pof"
git add src/lib/module-registry.ts docs/superpowers/specs/2026-05-23-combat-anim-driven-damage-design.md docs/superpowers/plans/2026-05-23-combat-anim-driven-damage.md
git commit -m "feat(arpg-combat): prompt default carries bUseAnimationDrivenDamage gray-box path

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (completed during planning)

**Spec coverage:**
- Spec "New properties" (`bUseAnimationDrivenDamage`, `GrayBoxHitDelay`, `MeleeHitRange`) → Task 3.
- Spec "Two refactors" (`FindForwardTarget`, `ApplyMeleeDamageTo`) → Task 4 Steps 1–2.
- Spec "Behavior" (`false` self-apply WaitDelay; `true` notify path) → Task 4 Steps 3–4.
- Spec "New tests" (`VSCombatGrayBoxPathTest`, `VSCombatAbilityGrantTest`) → Task 1; run in Tasks 2 & 5.
- Spec "Functional-test integration" decision (do not touch `VSFunctionalTest.cpp`; regression check) → Task 5 Step 3.
- Spec "PoF app side" (`acb-1` prompt default) → Task 6.
- Spec risk #1 (forward-cone orientation; enemy 400cm away) → Task 1 Step 2 Phase 0 (teleport ~150cm + orient).

**Type/name consistency:** `FindForwardTarget(float, float)` non-const, returns `AActor*` — declared (Task 3) and defined + both callers (`AcquireWarpTarget`, `OnGrayBoxHitWindow`) (Task 4) match. `ApplyMeleeDamageTo(AActor*, const FHitResult*)` — declared (Task 3), defined + both callers (`OnMeleeHit`, `OnGrayBoxHitWindow`) match. `OnGrayBoxHitWindow()` is `UFUNCTION()` (required for `AddDynamic`). Test class names match their `set_actor_label` in the placement script and the `Project.Functional Tests.Maps.VerticalSlice.<Label>` automation paths.

**Placeholder scan:** none — all code, paths, and commands are concrete.

**TDD note (UE build cost):** Strict red-green is honored across two builds (Task 2 = red on gray-box, Task 5 = green). Each incremental editor compile is ~1–3 min; the two-build cost is accepted to keep the red step a real run, not a prediction. The ability-grant test is green from the start (it asserts existing behavior) — its value is regression protection for sub-project (2).
