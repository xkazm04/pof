#include "AbilitySystem/GA_Death.h"
#include "AbilitySystem/ARPGGameplayTags.h"
#include "Character/ARPGCharacterBase.h"
#include "Character/ARPGEnemyCharacter.h"
#include "Combat/ARPGCombatTestDummy.h"
#include "Player/ARPGPlayerCharacter.h"
#include "AbilitySystemComponent.h"
#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "GameFramework/CharacterMovementComponent.h"

UGA_Death::UGA_Death()
{
	// Death never auto-ends — State.Dead persists until respawn clears it
	bAutoEndAbility = false;

	// Grant State.Dead while this ability is active — blocks all other abilities
	ActivationOwnedTags.AddTag(ARPGGameplayTags::State_Dead);

	// Event-triggered: activated by Event.Death sent from PostGameplayEffectExecute
	FAbilityTriggerData TriggerData;
	TriggerData.TriggerTag = ARPGGameplayTags::Event_Death;
	TriggerData.TriggerSource = EGameplayAbilityTriggerSource::GameplayEvent;
	AbilityTriggers.Add(TriggerData);
}

void UGA_Death::ActivateAbility(
	const FGameplayAbilitySpecHandle Handle,
	const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo,
	const FGameplayEventData* TriggerEventData)
{
	// Do NOT call Super — base class calls CommitAbility which we don't need for death.
	// Death has no cost and no cooldown.

	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character)
	{
		EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
		return;
	}

	UAbilitySystemComponent* ASC = GetARPGAbilitySystemComponent();

	// Cancel all other active abilities — death overrides everything
	if (ASC)
	{
		ASC->CancelAllAbilities(this);
	}

	// Disable movement
	if (UCharacterMovementComponent* MoveComp = Character->GetCharacterMovement())
	{
		MoveComp->DisableMovement();
		MoveComp->StopMovementImmediately();
	}

	// Disable collision so dead characters don't block others
	Character->SetActorEnableCollision(false);

	// Extract the killing actor from the death event payload
	AActor* KillingActor = (TriggerEventData && TriggerEventData->Instigator.Get() != nullptr)
		? const_cast<AActor*>(TriggerEventData->Instigator.Get()) : nullptr;

	// Notify the character subclass for type-specific death hooks
	if (AARPGPlayerCharacter* PlayerChar = Cast<AARPGPlayerCharacter>(Character))
	{
		PlayerChar->OnDeathFromAbility();
	}
	else if (AARPGEnemyCharacter* EnemyChar = Cast<AARPGEnemyCharacter>(Character))
	{
		EnemyChar->OnDeathFromAbility(KillingActor);
	}
	else if (AARPGCombatTestDummy* Dummy = Cast<AARPGCombatTestDummy>(Character))
	{
		Dummy->OnDeathFromAbility(KillingActor);
	}

	// Play death montage if available
	UAnimMontage* DeathMontage = Character->GetDeathMontage();
	if (DeathMontage)
	{
		UAbilityTask_PlayMontageAndWait* MontageTask =
			UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
				this,
				TEXT("PlayDeathMontage"),
				DeathMontage,
				MontagePlayRate,
				NAME_None,
				/*bStopWhenAbilityEnds=*/ false);

		MontageTask->OnCompleted.AddDynamic(this, &UGA_Death::OnMontageCompleted);
		MontageTask->OnBlendOut.AddDynamic(this, &UGA_Death::OnMontageBlendOut);
		MontageTask->OnInterrupted.AddDynamic(this, &UGA_Death::OnMontageInterrupted);
		MontageTask->OnCancelled.AddDynamic(this, &UGA_Death::OnMontageCancelled);
		MontageTask->ReadyForActivation();
	}
	else
	{
		// No montage — skip straight to post-death logic
		OnDeathMontageFinished();
	}

	UE_LOG(LogTemp, Log, TEXT("[GA_Death] %s has died. Instigator: %s"),
		*Character->GetName(),
		(TriggerEventData && TriggerEventData->Instigator.Get() != nullptr)
			? *TriggerEventData->Instigator->GetName()
			: TEXT("None"));
}

void UGA_Death::OnMontageCompleted()
{
	OnDeathMontageFinished();
}

void UGA_Death::OnMontageBlendOut()
{
	OnDeathMontageFinished();
}

void UGA_Death::OnMontageInterrupted()
{
	OnDeathMontageFinished();
}

void UGA_Death::OnMontageCancelled()
{
	OnDeathMontageFinished();
}

void UGA_Death::OnDeathMontageFinished()
{
	// OnBlendOut and OnCompleted both fire when a real montage plays — guard
	// against the second invocation to avoid double-broadcasting and double
	// calls to SetLifeSpan.
	if (bDeathMontageFinished)
	{
		return;
	}
	bDeathMontageFinished = true;

	AARPGCharacterBase* Character = GetARPGCharacter();
	if (!Character) return;

	// Enable ragdoll physics if configured
	if (bEnableRagdollAfterMontage)
	{
		Character->EnableRagdoll();
	}

	// Broadcast death finished so external systems can react
	Character->OnDeathFinished.Broadcast();

	// Player-specific: schedule respawn
	if (AARPGPlayerCharacter* PlayerChar = Cast<AARPGPlayerCharacter>(Character))
	{
		// Disable input on the player controller
		if (APlayerController* PC = Cast<APlayerController>(PlayerChar->GetController()))
		{
			PC->DisableInput(PC);
		}

		// Respawn is handled by the player character's existing system.
		// OnDeathFromAbility already set up the respawn timer.
	}
	else
	{
		// Enemy: start destroy timer
		if (EnemyDestroyDelay > 0.f)
		{
			Character->SetLifeSpan(EnemyDestroyDelay);
		}
	}

	// NOTE: We intentionally do NOT call EndAbility.
	// State.Dead persists via ActivationOwnedTags until respawn logic
	// cancels this ability or removes the tag externally.
}
