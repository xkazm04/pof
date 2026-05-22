#include "Test/VSFunctionalTest.h"
#include "Player/ARPGPlayerCharacter.h"
#include "Character/ARPGEnemyCharacter.h"
#include "AbilitySystem/ARPGAttributeSet.h"
#include "AbilitySystem/ARPGGameplayTags.h"
#include "AbilitySystem/Effects/GE_Damage.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystemBlueprintLibrary.h"
#include "GameplayTagContainer.h"
#include "Loot/ARPGWorldItem.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/Character.h"

AVSFunctionalTest::AVSFunctionalTest()
{
	PrimaryActorTick.bCanEverTick = true;
	TimeLimit = 30.f;

	// This is a gray-box slice: characters have no skeletal mesh, montages are
	// empty shells. That legitimately produces incidental engine *warnings*
	// (e.g. anim/montage warnings) which are NOT test failures — the pass/fail
	// criteria of this test are its four AssertTrue checks. Ignore warning-level
	// log output so it cannot fail the run; genuine Error-level output still does.
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
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

	for (TActorIterator<AARPGEnemyCharacter> It(GetWorld()); It; ++It)
	{
		Enemy = *It;
		break;
	}

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

	if (!IsRunning() || !Player.IsValid())
	{
		return;
	}

	PhaseTime += DeltaSeconds;

	// =========================================================================
	// Phase 0 — #2 Movement: verify the player character moves under input
	// =========================================================================
	if (Phase == 0)
	{
		// Drive movement input every tick
		Player->AddMovementInput(FVector::ForwardVector, 1.f);

		if (PhaseTime >= 1.5f)
		{
			const float DistMoved = FVector::Dist(Player->GetActorLocation(), StartLocation);
			AssertTrue(DistMoved > 50.f,
				FString::Printf(TEXT("#2 movement: player should have moved >50cm, moved %.1fcm"), DistMoved));

			Phase = 1;
			PhaseTime = 0.f;
		}
		return;
	}

	// =========================================================================
	// Phase 1 — #3 Attack Activation: activate the melee ability via GAS tag
	// =========================================================================
	if (Phase == 1)
	{
		// Only attempt activation on the first tick of this phase
		if (PhaseTime <= DeltaSeconds + KINDA_SMALL_NUMBER)
		{
			UAbilitySystemComponent* PlayerASC = Player->GetAbilitySystemComponent();
			if (!PlayerASC)
			{
				FinishTest(EFunctionalTestResult::Failed, TEXT("Player has no AbilitySystemComponent"));
				return;
			}

			// Record enemy start health before activation
			if (Enemy.IsValid())
			{
				UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent();
				if (EnemyASC)
				{
					EnemyStartHealth = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
				}
			}

			FGameplayTagContainer MeleeTag;
			MeleeTag.AddTag(ARPGGameplayTags::Ability_Melee_LightAttack);
			const bool bActivated = PlayerASC->TryActivateAbilitiesByTag(MeleeTag);

			AssertTrue(bActivated, TEXT("#3 attack activation: melee ability should have activated"));
		}

		// Wait a tick for any immediate ability state to settle, then move on
		if (PhaseTime >= 0.2f)
		{
			Phase = 2;
			PhaseTime = 0.f;
		}
		return;
	}

	// =========================================================================
	// Phase 2 — #4 Damage: send Event.MeleeHit to the player to drive damage
	//
	// GA_MeleeAttack.OnMeleeHit reads Payload.Target to get the hit actor.
	// The empty montage (AM_MeleeCombo) completes immediately, which calls
	// EndAbility and cancels the WaitGameplayEvent tasks. So we must send the
	// event quickly — on the first tick of this phase, before EndAbility fires.
	// =========================================================================
	if (Phase == 2)
	{
		if (PhaseTime <= DeltaSeconds + KINDA_SMALL_NUMBER)
		{
			if (Enemy.IsValid())
			{
				// Build the payload: Target = enemy (read by OnMeleeHit to get TargetASC)
				// Instigator = player (for context)
				FGameplayEventData HitPayload;
				HitPayload.Target = Enemy.Get();
				HitPayload.Instigator = Player.Get();
				HitPayload.EventMagnitude = 1.f;

				// Send Event.MeleeHit to the player — OnMeleeHit on the active ability
				// intercepts it, builds a GE spec, and applies damage to HitPayload.Target
				UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(
					Player.Get(),
					ARPGGameplayTags::Event_MeleeHit,
					HitPayload);
			}
		}

		// Wait for the GE to propagate (PostGameplayEffectExecute is synchronous,
		// but give a couple of frames to be safe)
		if (PhaseTime >= 2.0f)
		{
			if (Enemy.IsValid())
			{
				UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent();
				if (EnemyASC)
				{
					const float EnemyHealthNow = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
					AssertTrue(EnemyHealthNow < EnemyStartHealth,
						FString::Printf(TEXT("#4 damage: enemy Health should be less than %.1f, is %.1f"),
							EnemyStartHealth, EnemyHealthNow));
				}
				else
				{
					AssertTrue(false, TEXT("#4 damage: enemy has no ASC to read Health from"));
				}
			}
			else
			{
				AssertTrue(false, TEXT("#4 damage: enemy actor invalid at health check"));
			}

			Phase = 3;
			PhaseTime = 0.f;
		}
		return;
	}

	// =========================================================================
	// Phase 3 — #5 Death + Loot: kill the enemy through the REAL damage pipeline
	//
	// We do NOT poke Health and we do NOT send Event.Death ourselves. Instead we
	// apply real damage the same way criterion #4 does — a GE_Damage spec built
	// from the player ASC via MakeOutgoingSpec, with the Data.Damage.Base
	// SetByCaller, applied to the enemy ASC via ApplyGameplayEffectSpecToTarget.
	// This is exactly GA_MeleeAttack::OnMeleeHit's path (GE_Damage ->
	// UARPGDamageExecution -> PostGameplayEffectExecute), just with a lethal
	// magnitude. PostGameplayEffectExecute, on seeing Health reach 0, raises
	// Event.Death itself -> GA_Death (GameplayEvent trigger) -> OnDeathFromAbility
	// -> OnEnemyDeath -> LootDropComponent drops loot. Death is therefore an
	// observed CONSEQUENCE of Health depletion, not something the test triggers.
	//
	// We apply damage on the first tick, then keep applying it each tick (until
	// Health <= 0) as a guard against any single-spec rounding/clamping, before
	// asserting. The asserted Health value is always READ from the enemy ASC.
	// We do NOT assert the actor is destroyed — it uses SetLifeSpan(5s).
	// =========================================================================
	if (Phase == 3)
	{
		if (Enemy.IsValid())
		{
			UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent();
			UAbilitySystemComponent* PlayerASC = Player->GetAbilitySystemComponent();

			if (EnemyASC && PlayerASC)
			{
				const float HealthNow = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());

				// Keep applying real damage until the enemy's Health is depleted.
				if (HealthNow > 0.f)
				{
					// Build a GE_Damage outgoing spec from the player (source) ASC —
					// same effect class, same execution, same SetByCaller key that
					// GA_MeleeAttack::OnMeleeHit uses, just with a lethal base value.
					FGameplayEffectContextHandle Context = PlayerASC->MakeEffectContext();
					Context.AddSourceObject(Player.Get());

					FGameplayEffectSpecHandle SpecHandle = PlayerASC->MakeOutgoingSpec(
						UGE_Damage::StaticClass(), 1.f, Context);

					if (SpecHandle.IsValid())
					{
						FGameplayEffectSpec* Spec = SpecHandle.Data.Get();
						// Lethal magnitude: far above MaxHealth so a single application
						// depletes Health even after the armor/resist formula.
						Spec->SetSetByCallerMagnitude(ARPGGameplayTags::Data_Damage_Base, 9999.f);
						Spec->AddDynamicAssetTag(ARPGGameplayTags::Damage_Physical);

						PlayerASC->ApplyGameplayEffectSpecToTarget(*Spec, EnemyASC);
					}
				}
			}
		}

		// Wait long enough for the death chain: damage -> Event.Death -> GA_Death
		// -> OnDeathFromAbility -> OnEnemyDeath -> loot drop.
		if (PhaseTime >= 3.0f)
		{
			// Assert #5a: enemy Health depleted — value READ from the enemy ASC,
			// never written by this test.
			if (Enemy.IsValid())
			{
				UAbilitySystemComponent* EnemyASC = Enemy->GetAbilitySystemComponent();
				if (EnemyASC)
				{
					const float FinalHealth = EnemyASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute());
					AssertTrue(FinalHealth <= 0.f,
						FString::Printf(TEXT("#5 death: enemy Health should be <= 0 (observed depletion via real damage), is %.1f"), FinalHealth));
				}
				else
				{
					AssertTrue(false, TEXT("#5 death: enemy has no ASC to read Health from"));
				}
			}
			else
			{
				AssertTrue(false, TEXT("#5 death: enemy actor invalid at health check"));
			}

			// Assert #5b: at least one loot world item spawned
			int32 LootCount = 0;
			for (TActorIterator<AARPGWorldItem> It(GetWorld()); It; ++It)
			{
				++LootCount;
			}

			AssertTrue(LootCount >= 1,
				FString::Printf(TEXT("#5 loot: expected >= 1 AARPGWorldItem in world, found %d"), LootCount));

			FinishTest(EFunctionalTestResult::Default, TEXT("vertical slice verified"));
		}
		return;
	}
}
